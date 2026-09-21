from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    groq_api_key: str
    groq_model: str = "openai/gpt-oss-20b"

    cohere_api_key: str
    cohere_model: str = "embed-english-v3.0"

    supabase_url: str
    supabase_service_role_key: str
    supabase_table: str = "documents"
    match_function: str = "match_documents"

    knowledge_base_dir: str = str(BACKEND_ROOT / "data" / "knowledge_base")
    top_k: int = 4
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=str(BACKEND_ROOT / ".env"), extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
