from datetime import datetime

from pydantic import BaseModel


class IngestionRunItem(BaseModel):
    id: int
    source_slug: str
    source_name: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    articles_seen: int
    articles_inserted: int
    articles_skipped: int
    error: str | None


class IngestionSummary(BaseModel):
    runs_last_hour: int
    runs_last_24h: int
    success_count_24h: int
    error_count_24h: int
    not_modified_24h: int
    articles_inserted_24h: int
    articles_skipped_24h: int
    avg_duration_ms: int | None
    sources_total: int
    sources_active: int
    last_run_at: datetime | None
    ingestion_running: bool


class TriggerResponse(BaseModel):
    status: str  # "started" | "already_running"
    sources: int
    message: str
