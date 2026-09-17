"""One-off CLI: load knowledge_base/*.md -> chunk -> embed -> store in Chroma.

Run with:  python scripts/ingest.py
Re-run any time the markdown files under data/knowledge_base/ change.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.ingest import run_ingestion  # noqa: E402


def main():
    result = run_ingestion()
    if result["files_processed"] == 0:
        print("No markdown files found in the knowledge base directory.")
        return
    print(f"Processed {result['files_processed']} files, indexed {result['chunks_indexed']} chunks.")


if __name__ == "__main__":
    main()
