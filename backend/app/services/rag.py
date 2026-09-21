import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.services.embeddings import embed_query
from app.services.vectorstore import query as query_vectorstore

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You are an expert cricket rules assistant. You answer questions about the \
Laws of Cricket and common playing conditions (LBW, DRS, no-balls, wides, run-outs, follow-on, \
powerplays, boundary/catch rules, etc.).

Answer ONLY using the rule excerpts provided in the context below. If the context does not \
contain enough information to answer confidently, say you don't have that rule in your \
knowledge base rather than guessing. Keep answers clear and concise, and reference the \
relevant law/rule name when helpful.

Use the prior conversation turns to understand follow-up questions (e.g. "what about in T20s?"
after discussing follow-on rules), but still ground every factual claim in the provided context."""

MAX_HISTORY_MESSAGES = 20


def retrieve(question: str, top_k: int | None = None):
    k = top_k or settings.top_k
    embedding = embed_query(question)
    # Over-fetch, then dedupe by (file, heading) so overlapping chunk splits
    # from the same section don't crowd out other distinct rule sections.
    rows = query_vectorstore(embedding, k * 3)

    seen: set[tuple[str, str]] = set()
    sources = []
    for row in rows:
        file = row.get("file", "")
        heading = row.get("heading", file)
        key = (file, heading)
        if key in seen:
            continue
        seen.add(key)

        sources.append(
            {
                "title": heading,
                "file": file,
                "snippet": row.get("content", ""),
                "score": round(row.get("similarity", 0.0), 4),
            }
        )
        if len(sources) >= k:
            break

    return sources


def _build_prompt(question: str, sources: list[dict]) -> str:
    context = "\n\n---\n\n".join(s["snippet"] for s in sources)
    return f"Context (rule excerpts):\n\n{context}\n\n---\n\nQuestion: {question}"


def _build_messages(question: str, sources: list[dict], history: list[dict] | None = None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for turn in (history or [])[-MAX_HISTORY_MESSAGES:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": _build_prompt(question, sources)})
    return messages


def _groq_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }


async def answer_stream(question: str, history: list[dict] | None = None) -> AsyncIterator[dict]:
    """Yields dicts of shape {"type": "token", "text": str} for each streamed
    token, followed by a final {"type": "sources", "sources": [...]}."""
    sources = retrieve(question)
    messages = _build_messages(question, sources, history)

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            GROQ_CHAT_URL,
            headers=_groq_headers(),
            json={"model": settings.groq_model, "messages": messages, "stream": True},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                payload = line[len("data: ") :]
                if payload == "[DONE]":
                    break
                chunk = json.loads(payload)
                delta = chunk["choices"][0].get("delta", {})
                content = delta.get("content", "")
                if content:
                    yield {"type": "token", "text": content}

    yield {"type": "sources", "sources": sources}


def answer_once(question: str, history: list[dict] | None = None) -> dict:
    sources = retrieve(question)
    messages = _build_messages(question, sources, history)

    response = httpx.post(
        GROQ_CHAT_URL,
        headers=_groq_headers(),
        json={"model": settings.groq_model, "messages": messages, "stream": False},
        timeout=60.0,
    )
    response.raise_for_status()
    answer_text = response.json()["choices"][0]["message"]["content"]
    return {"answer": answer_text, "sources": sources}
