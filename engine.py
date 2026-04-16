from collections.abc import Iterable

import chromadb
from jixia.structs import LeanName, DeclarationKind
from psycopg import Connection
from psycopg.rows import class_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict

from database.embedding import GeminiEmbedding


class Record(BaseModel):
    module_name: LeanName
    kind: DeclarationKind
    name: LeanName
    signature: str
    type: str
    value: str | None
    docstring: str | None
    informal_name: str
    informal_description: str

    model_config = ConfigDict(extra="allow")


class QueryResult(BaseModel):
    result: Record
    distance: float


class PhyslibSearchEngine:
    def __init__(self, path: str, conn: Connection):
        self.conn = conn
        self.client = chromadb.PersistentClient(path)
        self.collection = self.client.get_collection(name="physlibsearch", embedding_function=None)
        self.embedding = GeminiEmbedding(task_type="RETRIEVAL_QUERY")

    def fetch_declarations(self, names: Iterable[LeanName]) -> list[Record]:
        ret = []
        with self.conn.cursor(row_factory=class_row(Record)) as cursor:
            for n in names:
                cursor.execute(
                    """
                    SELECT * FROM record
                    WHERE name = %s
                    """,
                    (Jsonb(n),),
                )
                ret.append(cursor.fetchone())
        return ret

    def find_declarations(self, queries: list[str], num_results: int) -> list[list[QueryResult]]:
        query_embedding = self.embedding.embed(queries)
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=num_results,
            include=["distances"],
        )
        ret = []
        with self.conn.cursor(row_factory=class_row(Record)) as cursor:
            for ids, distances in zip(results["ids"], results["distances"]):
                current_results = []
                for doc_id, distance in zip(ids, distances):
                    name = doc_id.split(" ")
                    cursor.execute(
                        """
                        SELECT * FROM record
                        WHERE name = %s
                        """,
                        (Jsonb(name),),
                    )
                    result = cursor.fetchone()
                    current_results.append(QueryResult(result=result, distance=distance))
                ret.append(current_results)
        return ret
