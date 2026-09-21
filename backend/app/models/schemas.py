from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []


class Source(BaseModel):
    title: str
    file: str
    snippet: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]


class IngestResponse(BaseModel):
    files_processed: int
    chunks_indexed: int
