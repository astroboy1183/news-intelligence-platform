"""Global search across stories, entities, and topics.

Powers the frontend command palette (⌘K). Single endpoint returning a mixed result
list so the UI doesn't fan out three requests on every keystroke. ILIKE is fine for
v1 — if latency or quality becomes a problem we can swap in pg_trgm + GIN indexes.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Entity, Story, Topic

router = APIRouter(prefix="/search", tags=["search"])


class SearchHit(BaseModel):
    kind: Literal["story", "entity", "topic"]
    id: int
    slug: str
    label: str
    sublabel: str  # human-readable secondary text (entity type, source_count, etc.)
    href: str
    score: float


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHit]


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, max_length=120),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    needle = f"%{q.strip()}%"
    per_kind = max(3, limit // 3 + 2)

    # Stories: recent + many-source rank highest. We bias toward stories updated in the
    # last 7d so old archived stories don't clutter the palette when the user types
    # something common like "delhi".
    recency_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    story_rows = (await db.execute(
        select(
            Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at,
            Story.primary_country,
        )
        .where(Story.name.ilike(needle))
        .order_by(
            (Story.last_updated_at >= recency_cutoff).desc(),
            Story.source_count.desc(),
            Story.last_updated_at.desc(),
        )
        .limit(per_kind)
    )).all()

    entity_rows = (await db.execute(
        select(Entity.id, Entity.slug, Entity.name, Entity.type)
        .where(Entity.name.ilike(needle))
        .order_by(func.length(Entity.name).asc())  # shorter names rank higher (less noise)
        .limit(per_kind)
    )).all()

    topic_rows = (await db.execute(
        select(Topic.id, Topic.slug, Topic.name)
        .where(Topic.name.ilike(needle))
        .order_by(func.length(Topic.name).asc())
        .limit(per_kind)
    )).all()

    hits: list[SearchHit] = []

    # Stories first so they take the top slots — story names are usually what
    # the user is hunting for.
    for sid, slug, name, source_count, last_at, country in story_rows:
        sub_parts = [f"{source_count} outlets"]
        if country:
            sub_parts.append(country)
        hits.append(SearchHit(
            kind="story", id=sid, slug=slug, label=name,
            sublabel=" · ".join(sub_parts),
            href=f"/stories/{sid}",
            score=float(source_count) + (5.0 if last_at and last_at >= recency_cutoff else 0.0),
        ))

    for eid, slug, name, type_ in entity_rows:
        hits.append(SearchHit(
            kind="entity", id=eid, slug=slug, label=name,
            sublabel=type_.lower(),
            href=f"/entities/{slug}",
            score=1.0,
        ))

    for tid, slug, name in topic_rows:
        hits.append(SearchHit(
            kind="topic", id=tid, slug=slug, label=name,
            sublabel="topic",
            href=f"/topics/{slug}",
            score=0.5,
        ))

    # Stable secondary sort by label length so a query like "modi" surfaces "Modi"
    # ahead of "Narendra Modi visits…" inside the entity bucket.
    hits.sort(key=lambda h: (-h.score, len(h.label)))
    return SearchResponse(query=q, hits=hits[:limit])
