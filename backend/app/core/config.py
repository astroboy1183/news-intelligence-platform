from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "News Intelligence Platform"
    environment: str = "dev"

    database_url: str = "postgresql+asyncpg://nip:nip_pass@localhost:5432/nip"

    redis_url: str = "redis://localhost:6379/0"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_audio: str = "audio"

    prefect_api_url: str = "http://localhost:4200/api"

    ingestion_interval_seconds: int = 120
    per_host_concurrency: int = 2
    fetch_timeout_seconds: int = 10

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    spacy_model: str = "en_core_web_sm"
    cluster_similarity_threshold: float = 0.78


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
