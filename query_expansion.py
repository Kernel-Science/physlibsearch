import asyncio
import os
import re

import jinja2
from jinja2 import Environment, FileSystemLoader
from openai import AsyncOpenAI


class QueryExpander:
    def __init__(self, model: str):
        self.env = Environment(
            loader=FileSystemLoader(os.environ.get("PROMPT_DIR", "prompt")),
            enable_async=True,
            undefined=jinja2.StrictUndefined,
        )
        self.template = self.env.get_template("augment_prompt.j2")
        with open("prompt/augment_assistant.txt") as fp:
            self.assistant_prompt = fp.read()
        self.client = AsyncOpenAI(
            api_key=os.environ.get("LLM_API_KEY", os.environ["GEMINI_API_KEY"]),
            base_url=os.environ.get("LLM_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
        )
        self.model = model
        # Matches everything after "Hypothetical: " — the full hypothetical declaration
        self.pattern = re.compile(r'Hypothetical:\s*(.*)', re.DOTALL)

    async def expand(self, user_input: str) -> str | None:
        """
        HyDE (Hypothetical Document Embeddings): generates a plausible Lean 4 / Physlib
        declaration that would answer the query, then returns it as the text to embed.
        This aligns the query embedding with the index embedding space.
        """
        prompt = await self.template.render_async(input=user_input)
        response = None
        for _ in range(5):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.assistant_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    stream=False,
                )
            except Exception:
                await asyncio.sleep(1)
                continue
            break
        if response is None:
            return user_input
        answer = response.choices[0].message.content
        try:
            return self.pattern.search(answer).group(1).strip()
        except AttributeError:
            return answer
