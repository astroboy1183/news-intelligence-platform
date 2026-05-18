from datetime import datetime

from pydantic import BaseModel


class StoryListItem(BaseModel):
    id: int
    slug: str
    name: str
    tldr: list[str] = []
    first_seen_at: datetime
    last_updated_at: datetime
    article_count: int
    source_count: int
    velocity_score: float
    primary_state: str | None = None
    primary_country: str | None = None
    category: str | None = None


class StoryArticleSummary(BaseModel):
    id: int
    title: str
    url: str
    source_slug: str
    source_name: str
    published_at: datetime | None
    fetched_at: datetime


class StoryEntityRef(BaseModel):
    slug: str
    name: str
    type: str
    mention_count: int


class StoryTopicRef(BaseModel):
    slug: str
    name: str
    score: float


class CoverageBreakdownItem(BaseModel):
    country: str
    outlet_count: int


class StoryDetail(StoryListItem):
    articles: list[StoryArticleSummary]
    entities: list[StoryEntityRef]
    topics: list[StoryTopicRef]
    coverage_by_country: list[CoverageBreakdownItem]
    first_reported_by_source_slug: str | None = None
