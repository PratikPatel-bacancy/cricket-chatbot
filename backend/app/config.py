from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    embedding_model: str = "all-MiniLM-L6-v2"
    chroma_dir: str = str(BACKEND_ROOT / "chroma_db")
    knowledge_base_dir: str = str(BACKEND_ROOT / "data" / "knowledge_base")
    collection_name: str = "cricket_rules"
    top_k: int = 4
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=str(BACKEND_ROOT / ".env"), extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
