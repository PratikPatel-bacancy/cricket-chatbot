from pathlib import Path

from app.config import settings
from app.services.chunker import chunk_markdown
from app.services.embeddings import embed_texts
from app.services.vectorstore import add_chunks, reset_collection


def run_ingestion() -> dict:
    kb_dir = Path(settings.knowledge_base_dir)
    md_files = sorted(kb_dir.glob("*.md"))

    if not md_files:
        return {"files_processed": 0, "chunks_indexed": 0}

    reset_collection()

    all_chunks = []
    for md_file in md_files:
        content = md_file.read_text(encoding="utf-8")
        all_chunks.extend(chunk_markdown(content, md_file.name))

    if not all_chunks:
        return {"files_processed": len(md_files), "chunks_indexed": 0}

    texts = [c.text for c in all_chunks]
    embeddings = embed_texts(texts)
    ids = [f"{c.file}-{i}" for i, c in enumerate(all_chunks)]
    metadatas = [{"file": c.file, "heading": c.heading} for c in all_chunks]

    add_chunks(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)

    return {"files_processed": len(md_files), "chunks_indexed": len(all_chunks)}
