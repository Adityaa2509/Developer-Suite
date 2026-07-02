from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────
    APP_NAME: str = "Sherlock"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = "AI Agent that investigates Salesforce record anomalies"
    DEBUG: bool = False

    # ── LLM — Gemini ─────────────────────────────────────────────
    GEMINI_API_KEY: str
    GEMINI_API_KEY_FALLBACK: str | None = None
    GEMINI_MODEL_PRIMARY: str = "gemini-2.0-flash"
    GEMINI_MODEL_FALLBACK: str = "gemini-1.5-flash"

    # ── LLM — Groq ───────────────────────────────────────────────
    GROQ_API_KEY: str
    GROQ_API_KEY_FALLBACK: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # ── Embeddings ───────────────────────────────────────────────
    EMBEDDING_MODEL: str = "models/gemini-embedding-001"

    # ── Salesforce ───────────────────────────────────────────────
    SF_USERNAME: str
    SF_PASSWORD: str
    SF_SECURITY_TOKEN: str
    SF_DOMAIN: str = "login"
    SF_API_VERSION: str = "61.0"

    # ── Storage ──────────────────────────────────────────────────
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    DATABASE_URL: str = "sqlite:///./devmind.db"

    # ── Agent ────────────────────────────────────────────────────
    MAX_INVESTIGATION_LOOPS: int = 10
    CONFIDENCE_THRESHOLD: float = 80.0
    POLL_INTERVAL_SEC: int = 3

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
