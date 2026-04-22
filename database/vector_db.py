import os
import logging

import chromadb
from psycopg import Connection

from .embedding import GeminiEmbedding

logger = logging.getLogger(__name__)


def create_vector_db(conn: Connection, path: str, batch_size: int):
    embedding = GeminiEmbedding(task_type="RETRIEVAL_DOCUMENT")

    client = chromadb.PersistentClient(path)
    try:
        collection = client.get_collection(name="physlibsearch", embedding_function=None)
        existing_ids = set(collection.get(include=[])["ids"])
        logger.warning("using existing physlibsearch collection (%d vectors)", len(existing_ids))
    except Exception:
        collection = client.create_collection(
            name="physlibsearch",
            metadata={"hnsw:space": "cosine"},
            embedding_function=None,
        )
        existing_ids = set()
        logger.warning("created new physlibsearch collection")

    added = 0
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT s.name, d.module_name, d.index, s.kind, d.signature, s.type, i.name, i.description
            FROM
                symbol s
                LEFT JOIN declaration d ON s.name = d.name
                INNER JOIN informal i ON s.name = i.symbol_name
            WHERE d.visible = TRUE
        """)

        while batch := cursor.fetchmany(batch_size):
            batch_doc = []
            batch_id = []
            for name, module_name, index, kind, signature, tp, informal_name, informal_description in batch:
                if signature is None:
                    signature = tp
                # NOTE: the space character is not used in names from Physlib and its dependencies
                vec_id = " ".join(str(x) for x in name)
                if vec_id in existing_ids:
                    continue
                batch_doc.append(f"{kind} {name} {signature}\n{informal_name}: {informal_description}")
                batch_id.append(vec_id)
            if not batch_doc:
                continue
            if os.environ["DRY_RUN"] == "true":
                for doc in batch_doc:
                    logger.info("DRY_RUN:skipped embedding: %s", doc)
                return
            batch_embedding = embedding.embed(batch_doc)
            collection.add(embeddings=batch_embedding, ids=batch_id)
            added += len(batch_id)

    logger.warning("vector-db: added %d new vectors, %d already existed", added, len(existing_ids))
