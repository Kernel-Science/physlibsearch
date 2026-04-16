import os
import uuid
from contextlib import asynccontextmanager
from typing import Annotated

import dotenv
from fastapi import FastAPI, Body, Response, Cookie
from jixia.structs import LeanName
from psycopg.rows import scalar_row, class_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.requests import Request

from fastapi.middleware.cors import CORSMiddleware

from query_expansion import QueryExpander
from engine import QueryResult, PhyslibSearchEngine, Record


@asynccontextmanager
async def lifespan(app: FastAPI):
    dotenv.load_dotenv()
    with ConnectionPool(
            os.environ["CONNECTION_STRING"],
            kwargs={"autocommit": True},
            check=ConnectionPool.check_connection,
    ) as pool:
        app.expander = QueryExpander(os.environ["GEMINI_FAST_MODEL"])
        app.retriever = PhyslibSearchEngine(os.environ["CHROMA_PATH"], None)
        app.pool = pool
        yield


limiter = Limiter(key_func=get_remote_address, default_limits=["1/second"])
app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.middleware("http")
async def set_connection(request: Request, call_next):
    with app.pool.connection() as conn:
        app.retriever.conn = conn
        return await call_next(request)


app.add_middleware(SlowAPIMiddleware)


@app.post("/search")
def search(
        response: Response,
        query: list[str],
        num_results: Annotated[int, Body(gt=0, le=150)] = 10,
) -> list[list[QueryResult]]:
    if len(query) == 1:
        with app.retriever.conn.cursor(row_factory=scalar_row) as cursor:
            cursor.execute("""
                           INSERT INTO physlibsearch.query(id, query, time)
                           VALUES (GEN_RANDOM_UUID(), %s, NOW())
                           RETURNING id
                           """, (query[0],))
            session_id = cursor.fetchone()
            response.set_cookie("session", str(session_id))
    else:
        with app.retriever.conn.cursor() as cursor:
            cursor.executemany("""
                               INSERT INTO physlibsearch.query(id, query, time)
                               VALUES (GEN_RANDOM_UUID(), %s, NOW())
                               """, [(q,) for q in query])

    return app.retriever.find_declarations(query, num_results)


@app.post("/fetch")
@limiter.limit("10/second")
def fetch(request: Request, query: list[LeanName]) -> list[Record]:
    return app.retriever.fetch_declarations(query)


@app.post("/expand")
@limiter.limit("15/minute")
async def expand(request: Request, query: Annotated[str, Body()]) -> str:
    expanded = await app.expander.expand(query)
    return expanded


class Feedback(BaseModel):
    declaration: LeanName
    action: str
    cancel: bool | None = None


class UserFeedback(BaseModel):
    tab_name: str
    rating: int
    feedback_type: str = "general"
    message: str


class ModuleInfo(BaseModel):
    name: LeanName
    count: int


@app.get("/modules")
@limiter.limit("30/minute")
def list_modules(request: Request) -> list[ModuleInfo]:
    with app.pool.connection() as conn:
        with conn.cursor(row_factory=class_row(ModuleInfo)) as cursor:
            cursor.execute("""
                SELECT d.module_name AS name, COUNT(*) AS count
                FROM declaration d
                WHERE d.visible = TRUE
                  AND EXISTS(SELECT 1 FROM informal i WHERE i.symbol_name = d.name)
                GROUP BY d.module_name
                ORDER BY d.module_name
            """)
            return cursor.fetchall()


@app.post("/modules/declarations")
@limiter.limit("30/minute")
def module_declarations(request: Request, module_name: LeanName) -> list[Record]:
    with app.pool.connection() as conn:
        with conn.cursor(row_factory=class_row(Record)) as cursor:
            cursor.execute("""
                SELECT r.*
                FROM record r
                INNER JOIN declaration d ON r.name = d.name
                WHERE r.module_name = %s AND d.visible = TRUE
                ORDER BY d.index
            """, (Jsonb(module_name),))
            return cursor.fetchall()


@app.post("/user-feedback")
@limiter.limit("10/minute")
async def user_feedback(request: Request, body: UserFeedback):
    if not (1 <= body.rating <= 5):
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")
    with app.pool.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO physlibsearch.user_feedback
                    (tab_name, rating, feedback_type, message, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                """,
                (body.tab_name, body.rating, body.feedback_type, body.message),
            )


@app.post("/feedback")
async def feedback(session: Annotated[str, Cookie()], body: Feedback):
    query_id = uuid.UUID(session)
    if body.cancel:
        with app.retriever.conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM physlibsearch.feedback WHERE query_id = %s AND declaration_name = %s",
                (query_id, Jsonb(body.declaration))
            )
    else:
        with app.retriever.conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO physlibsearch.feedback(query_id, declaration_name, action) VALUES (%s, %s, %s)",
                (query_id, Jsonb(body.declaration), body.action)
            )
