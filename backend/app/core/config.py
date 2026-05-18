from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "News Intelligence Platform"
    environment: str = "dev"

    # Comma-separated origins allowed by CORS. Dev default = "*".
    # In prod set in .env e.g. "https://newsintel.vercel.app,http://localhost:3000"
    cors_origins: str = "*"

    # These defaults are deliberate non-credentials — they only apply when no
    # env var is provided, and the DB connection will fail fast if you actually
    # try to use them. Always set DATABASE_URL via .env.
    database_url: str = "postgresql+asyncpg://nip:CHANGE_ME@localhost:5432/nip"

    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "CHANGE_ME"
    s3_secret_key: str = "CHANGE_ME"
    s3_bucket_audio: str = "audio"

    prefect_api_url: str = "http://localhost:4200/api"

    ingestion_interval_seconds: int = 120
    per_host_concurrency: int = 2
    fetch_timeout_seconds: int = 10

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    spacy_model: str = "en_core_web_sm"
    cluster_similarity_threshold: float = 0.78

    @field_validator("database_url", mode="before")
    @classmethod
    def _coerce_to_asyncpg(cls, value: str) -> str:
        """Railway / Heroku / many managed Postgres providers hand out URLs as
        `postgresql://...` (libpq form). SQLAlchemy's async engine needs
        `postgresql+asyncpg://...`. Convert transparently so the platform's
        injected DATABASE_URL works without manual editing."""
        if not isinstance(value, str):
            return value
        if value.startswith("postgresql+"):
            return value  # already has a driver scheme
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://"):]
        if value.startswith("postgresql://"):
            return "postgresql+asyncpg://" + value[len("postgresql://"):]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
