import re
from dataclasses import dataclass

MAX_CHUNK_CHARS = 1500
OVERLAP_CHARS = 150


@dataclass
class Chunk:
    text: str
    heading: str
    file: str


def _split_long_text(text: str, max_chars: int, overlap: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]

    parts = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        parts.append(text[start:end].strip())
        if end == len(text):
            break
        start = end - overlap
    return [p for p in parts if p]


def chunk_markdown(content: str, file_name: str) -> list[Chunk]:
    """Split a markdown doc into chunks along ## headings, then further split
    any section that is still too long, preserving the heading as context."""
    title_match = re.search(r"^#\s+(.+)$", content, flags=re.MULTILINE)
    doc_title = title_match.group(1).strip() if title_match else file_name

    sections = re.split(r"\n(?=##\s+)", content)
    chunks: list[Chunk] = []

    for section in sections:
        section = section.strip()
        if not section:
            continue

        heading_match = re.match(r"^##\s+(.+)$", section, flags=re.MULTILINE)
        heading = heading_match.group(1).strip() if heading_match else doc_title

        body = re.sub(r"^#{1,2}\s+.+$", "", section, count=1, flags=re.MULTILINE).strip()
        if not body:
            continue

        for piece in _split_long_text(body, MAX_CHUNK_CHARS, OVERLAP_CHARS):
            chunk_text = f"{doc_title} — {heading}\n\n{piece}"
            chunks.append(Chunk(text=chunk_text, heading=heading, file=file_name))

    return chunks
