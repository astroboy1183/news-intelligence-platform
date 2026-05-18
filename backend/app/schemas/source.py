from datetime import datetime

from pydantic import BaseModel


class SourceItem(BaseModel):
    slug: str
    name: str
    url: str
    country: str
    region: str | None
    region_bucket: str
    political_lean: str
    tier: str
    is_active: bool
    last_fetched_at: datetime | None
    articles_24h: int = 0
    last_run_status: str | None = None


class SourceHealthSummary(BaseModel):
    active: int
    total: int
    healthy: int
    stale: int
    failing: int
    articles_per_hour: float
    last_run_at: datetime | None
