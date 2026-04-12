import logging
import os
import time

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

DIMENSION = 3072  # gemini-embedding-2-preview default output dimension


class GeminiEmbedding:
    def __init__(self, task_type: str = "RETRIEVAL_DOCUMENT"):
        self.task_type = task_type
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        self.model = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2-preview")

    def embed(self, docs: list[str]) -> list[list[float]]:
        for attempt in range(5):
            try:
                response = self.client.models.embed_content(
                    model=self.model,
                    contents=docs,
                    config=types.EmbedContentConfig(task_type=self.task_type),
                )
                return [e.values for e in response.embeddings]
            except Exception as e:
                if attempt < 4:
                    wait = 5 * (attempt + 1)
                    logger.warning("embed attempt %d failed (%s); retrying in %ds", attempt + 1, e, wait)
                    time.sleep(wait)
                else:
                    raise
