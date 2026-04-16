import asyncio
import logging
import os

from jixia.structs import LeanName, pp_name
from psycopg import Connection
from psycopg.rows import scalar_row, args_row
from psycopg.types.json import Jsonb

from .translate import TranslatedItem, TranslationInput, TranslationEnvironment

logger = logging.getLogger(__name__)


def find_neighbor(conn: Connection, module_name: LeanName, index: int, num_neighbor: int = 2) -> list[TranslatedItem]:
    with conn.cursor(row_factory=args_row(TranslatedItem)) as cursor:
        cursor.execute(
            """
            SELECT d.name, d.signature, i.name, i.description
            FROM
                declaration d
                LEFT JOIN informal i ON d.name = i.symbol_name
            WHERE
                d.module_name = %s AND d.index >= %s AND d.index <= %s
            """,
            (Jsonb(module_name), index - num_neighbor, index + num_neighbor),
        )
        return cursor.fetchall()


def find_dependency(conn: Connection, name: LeanName) -> list[TranslatedItem]:
    with conn.cursor(row_factory=args_row(TranslatedItem)) as cursor:
        cursor.execute(
            """
            SELECT d.name, d.signature, i.name, i.description
            FROM
                declaration d
                INNER JOIN dependency e ON d.name = e.target
                LEFT JOIN informal i ON d.name = i.symbol_name
            WHERE
                e.source = %s
            """,
            (Jsonb(name),),
        )
        return cursor.fetchall()


def generate_informal(conn: Connection, batch_size: int = 50, limit_level: int | None = None, limit_num_per_level: int | None = None):
    max_level: int
    if limit_level is None:
        with conn.cursor(row_factory=scalar_row) as cursor:
            max_level = cursor.execute("SELECT MAX(level) FROM level").fetchone() or -1
    else:
        max_level = limit_level

    with conn.cursor(row_factory=scalar_row) as cnt_cursor:
        total_remaining = cnt_cursor.execute("SELECT COUNT(*) FROM symbol s WHERE NOT EXISTS(SELECT 1 FROM informal i WHERE i.symbol_name = s.name)").fetchone() or 0
    done = 0
    logger.warning("starting informalization: %d declarations remaining", total_remaining)

    tasks = []
    with conn.cursor() as cursor, conn.cursor() as insert_cursor:
        for level in range(max_level + 1):
            query = """
                SELECT s.name, s.kind, s.type, d.signature, d.value, d.docstring, m.docstring, d.module_name, d.index
                FROM
                    symbol s
                    LEFT JOIN declaration d ON s.name = d.name
                    INNER JOIN module m ON s.module_name = m.name
                    INNER JOIN level l ON s.name = l.symbol_name
                WHERE
                    l.level = %s AND
                    (NOT EXISTS(SELECT 1 FROM informal i WHERE i.symbol_name = s.name))
            """
            if limit_num_per_level:
                cursor.execute(query + " LIMIT %s", (level, limit_num_per_level))
            else:
                cursor.execute(query, (level,))

            while batch := cursor.fetchmany(batch_size):
                done += len(batch)
                logger.warning("level %d | batch %d/%d (%.0f%%)", level, done, total_remaining, 100 * done / max(total_remaining, 1))
                env = TranslationEnvironment(model=os.environ["GEMINI_MODEL"])

                async def translate_and_insert(name: LeanName, data: TranslationInput):
                    result = await env.translate(data)
                    if result is None:
                        logger.warning("failed to translate %s, using fallback", name)
                        informal_name = pp_name(name)
                        informal_description = data.signature
                    else:
                        logger.info("translated %s", name)
                        informal_name, informal_description = result
                    insert_cursor.execute(
                        """
                        INSERT INTO informal (symbol_name, name, description)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                        """,
                        (Jsonb(name), informal_name, informal_description),
                    )

                tasks.clear()
                for row in batch:
                    name, kind, tp, signature, value, docstring, header, module_name, index = row

                    logger.info("translating %s", name)
                    if module_name is not None:
                        neighbor = find_neighbor(conn, module_name, index)
                    else:
                        neighbor = []
                    dependency = find_dependency(conn, name)

                    ti = TranslationInput(
                        name=name,
                        signature=signature if signature is not None else tp,
                        value=value,
                        docstring=docstring,
                        kind=kind,
                        header=header,
                        neighbor=neighbor,
                        dependency=dependency,
                    )
                    tasks.append(translate_and_insert(name, ti))

                async def wait_all():
                    for task in tasks:
                        await task
                        await asyncio.sleep(0.5)
                    await env.client.close()

                asyncio.run(wait_all())
