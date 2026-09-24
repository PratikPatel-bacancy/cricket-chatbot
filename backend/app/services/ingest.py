from pathlib import Path

from app.config import settings
from app.services.chunker import chunk_markdown
from app.services.embeddings import embed_texts
from app.services.vectorstore import add_chunks, reset_collection


def run_ingestion() -> dict:
    kb_dir = Path(settings.knowledge_base_dir)
    sport_dirs = sorted(d for d in kb_dir.iterdir() if d.is_dir())

    if not sport_dirs:
        return {"files_processed": 0, "chunks_indexed": 0}

    reset_collection()

    all_chunks = []
    sports = []
    files_processed = 0
    for sport_dir in sport_dirs:
        for md_file in sorted(sport_dir.glob("*.md")):
            content = md_file.read_text(encoding="utf-8")
            chunks = chunk_markdown(content, md_file.name)
            all_chunks.extend(chunks)
            sports.extend([sport_dir.name] * len(chunks))
            files_processed += 1

    if not all_chunks:
        return {"files_processed": files_processed, "chunks_indexed": 0}

    texts = [c.text for c in all_chunks]
    embeddings = embed_texts(texts, input_type="search_document")

    rows = [
        {"content": c.text, "file": c.file, "heading": c.heading, "sport": sport, "embedding": embedding}
        for c, sport, embedding in zip(all_chunks, sports, embeddings)
    ]
    add_chunks(rows)

    return {"files_processed": files_processed, "chunks_indexed": len(all_chunks)}
