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
        client.delete_collection("physlibsearch")
        logger.info("deleted existing physlibsearch collection")
    except Exception:
        pass
    collection = client.create_collection(
        name="physlibsearch",
        metadata={"hnsw:space": "cosine"},
        embedding_function=None,
    )

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
                batch_doc.append(f"{kind} {name} {signature}\n{informal_name}: {informal_description}")
                # NOTE: the space character is not used in names from Physlib and its dependencies
                batch_id.append(" ".join(str(x) for x in name))
                if os.environ["DRY_RUN"] == "true":
                    logger.info("DRY_RUN:skipped embedding: %s", f"{kind} {name} {signature} {informal_name}")
            if os.environ["DRY_RUN"] == "true":
                return
            batch_embedding = embedding.embed(batch_doc)
            collection.add(embeddings=batch_embedding, ids=batch_id)
