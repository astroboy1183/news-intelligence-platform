from datetime import datetime

from pydantic import BaseModel


# ------- threads -------

class ThreadListItem(BaseModel):
    id: int
    slug: str
    name: str
    first_seen_at: datetime
    last_updated_at: datetime
    story_count: int
    status: str


class ThreadStoryRef(BaseModel):
    id: int
    slug: str
    name: str
    source_count: int
    first_seen_at: datetime
    role: str


class ThreadDetail(ThreadListItem):
    stories: list[ThreadStoryRef]


# ------- anomalies -------

class AnomalyItem(BaseModel):
    id: int
    type: str
    severity: float
    detected_at: datetime
    label: str
    href: str | None = None
    payload: dict


# ------- predictions -------

class PredictionItem(BaseModel):
    story_id: int
    story_slug: str
    story_name: str
    source_count_now: int
    predicted_outlets_24h: int
    confidence: float
    predicted_at: datetime


class PredictionAccuracy(BaseModel):
    total: int
    correct: int
    accuracy: float
    avg_lead_hours: float | None


# ------- network -------

class NetworkNode(BaseModel):
    id: int
    slug: str
    name: str
    type: str
    weight: int


class NetworkEdge(BaseModel):
    source: int
    target: int
    weight: int


class NetworkGraph(BaseModel):
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]


# ------- source intelligence -------

class BreakingPowerItem(BaseModel):
    slug: str
    name: str
    stories_broken: int


class SourceOverlapRow(BaseModel):
    a_slug: str
    b_slug: str
    overlap: float
    shared_stories: int


# ------- insights / brief -------

class InsightSection(BaseModel):
    label: str
    items: list[dict]


class InsightsSummary(BaseModel):
    anomalies_today: list[AnomalyItem]
    first_to_break: list[BreakingPowerItem]
    quiet_but_important: list[dict]
    coverage_gaps: list[dict]


class BriefSummary(BaseModel):
    generated_at: datetime
    top_stories: list[dict]
    whats_changed: dict
    anomalies: list[AnomalyItem]
    regional_pulse: list[dict]


# ------- compare -------

class CompareSeriesPoint(BaseModel):
    bucket: str
    count: int


class CompareResult(BaseModel):
    a: dict
    b: dict
    by_lean: list[dict]
    co_topics_a: list[dict]
    co_topics_b: list[dict]


# ------- trends -------

class TrendPoint(BaseModel):
    bucket: str
    count: int


class TrendSeries(BaseModel):
    name: str
    slug: str
    points: list[TrendPoint]


# ------- map -------

class StateRollup(BaseModel):
    state: str
    code: str | None
    story_count: int
