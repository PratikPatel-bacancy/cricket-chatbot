import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.services.embeddings import embed_query
from app.services.vectorstore import query as query_vectorstore

SYSTEM_PROMPT = """You are an expert cricket rules assistant. You answer questions about the \
Laws of Cricket and common playing conditions (LBW, DRS, no-balls, wides, run-outs, follow-on, \
powerplays, boundary/catch rules, etc.).

Answer ONLY using the rule excerpts provided in the context below. If the context does not \
contain enough information to answer confidently, say you don't have that rule in your \
knowledge base rather than guessing. Keep answers clear and concise, and reference the \
relevant law/rule name when helpful."""


def retrieve(question: str, top_k: int | None = None):
    k = top_k or settings.top_k
    embedding = embed_query(question)
    # Over-fetch, then dedupe by (file, heading) so overlapping chunk splits
    # from the same section don't crowd out other distinct rule sections.
    results = query_vectorstore(embedding, k * 3)

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    seen: set[tuple[str, str]] = set()
    sources = []
    for doc, meta, dist in zip(documents, metadatas, distances):
        file = meta.get("file", "")
        heading = meta.get("heading", file)
        key = (file, heading)
        if key in seen:
            continue
        seen.add(key)

        sources.append(
            {
                "title": heading,
                "file": file,
                "snippet": doc,
                "score": round(1 - dist, 4),
            }
        )
        if len(sources) >= k:
            break

    return sources


def _build_prompt(question: str, sources: list[dict]) -> str:
    context = "\n\n---\n\n".join(s["snippet"] for s in sources)
    return f"Context (rule excerpts):\n\n{context}\n\n---\n\nQuestion: {question}"


def _build_messages(question: str, sources: list[dict]) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": _build_prompt(question, sources)},
    ]


async def answer_stream(question: str) -> AsyncIterator[dict]:
    """Yields dicts of shape {"type": "token", "text": str} for each streamed
    token, followed by a final {"type": "sources", "sources": [...]}."""
    sources = retrieve(question)
    messages = _build_messages(question, sources)

    async with httpx.AsyncClient(base_url=settings.ollama_host, timeout=120.0) as client:
        async with client.stream(
            "POST",
            "/api/chat",
            json={"model": settings.ollama_model, "messages": messages, "stream": True},
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield {"type": "token", "text": content}
                if chunk.get("done"):
                    break

    yield {"type": "sources", "sources": sources}


def answer_once(question: str) -> dict:
    sources = retrieve(question)
    messages = _build_messages(question, sources)

    response = httpx.post(
        f"{settings.ollama_host}/api/chat",
        json={"model": settings.ollama_model, "messages": messages, "stream": False},
        timeout=120.0,
    )
    response.raise_for_status()
    answer_text = response.json().get("message", {}).get("content", "")
    return {"answer": answer_text, "sources": sources}
