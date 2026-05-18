"""Insights endpoints: anomalies, first-to-break, quiet stories, coverage gaps."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Anomaly, Article, Entity, Source, Story
from app.schemas.intelligence import (
    AnomalyItem,
    BreakingPowerItem,
    InsightsSummary,
)

router = APIRouter(prefix="/insights", tags=["insights"])


async def _recent_anomalies(db: AsyncSession, hours: int = 24, limit: int = 20) -> list[AnomalyItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = (await db.execute(
        select(Anomaly, Entity.slug, Entity.name, Story.id, Story.slug, Story.name)
        .outerjoin(Entity, Entity.id == Anomaly.target_entity_id)
        .outerjoin(Story, Story.id == Anomaly.target_story_id)
        .where(Anomaly.detected_at >= cutoff)
        .order_by(Anomaly.severity.desc())
        .limit(limit)
    )).all()
    items: list[AnomalyItem] = []
    for anomaly, ent_slug, ent_name, story_id, story_slug, story_name in rows:
        if ent_slug:
            label = ent_name or ent_slug
            href = f"/entities/{ent_slug}"
        elif story_slug:
            label = story_name or story_slug
            href = f"/stories/{story_id}"
        else:
            label = anomaly.type
            href = None
        items.append(AnomalyItem(
            id=anomaly.id, type=anomaly.type, severity=anomaly.severity,
            detected_at=anomaly.detected_at, label=label, href=href,
            payload=dict(anomaly.payload or {}),
        ))
    return items


async def _first_to_break(db: AsyncSession, hours: int = 24, limit: int = 10) -> list[BreakingPowerItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = (await db.execute(
        select(Source.slug, Source.name, func.count(Story.id))
        .join(Story, Story.first_reported_by_source_id == Source.id)
        .where(Story.first_seen_at >= cutoff)
        .group_by(Source.slug, Source.name)
        .order_by(desc(func.count(Story.id)))
        .limit(limit)
    )).all()
    return [BreakingPowerItem(slug=s, name=n, stories_broken=int(c)) for s, n, c in rows]


async def _quiet_but_important(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Low-coverage stories whose entities overlap with high-coverage major stories."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = (await db.execute(
        select(Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at)
        .where(
            Story.source_count <= 4,
            Story.source_count >= 2,
            Story.last_updated_at >= cutoff,
        )
        .order_by(Story.velocity_score.desc(), Story.last_updated_at.desc())
        .limit(limit)
    )).all()
    return [
        {"id": sid, "slug": slug, "name": name, "source_count": sc, "last_updated_at": ts.isoformat()}
        for (sid, slug, name, sc, ts) in rows
    ]


async def _coverage_gaps(db: AsyncSession, limit: int = 10) -> list[dict]:
    rows = (await db.execute(
        select(Anomaly, Story.id, Story.slug, Story.name)
        .join(Story, Story.id == Anomaly.target_story_id)
        .where(Anomaly.type == "coverage_gap")
        .order_by(Anomaly.detected_at.desc())
        .limit(limit)
    )).all()
    return [
        {
            "story_id": sid, "slug": slug, "name": name,
            "in": (a.payload or {}).get("in", 0),
            "global": (a.payload or {}).get("global", 0),
            "gap": (a.payload or {}).get("gap", "?"),
        }
        for (a, sid, slug, name) in rows
    ]


@router.get("/summary", response_model=InsightsSummary)
async def insights_summary(db: AsyncSession = Depends(get_db)) -> InsightsSummary:
    anomalies = await _recent_anomalies(db)
    breakers = await _first_to_break(db)
    quiet = await _quiet_but_important(db)
    gaps = await _coverage_gaps(db)
    return InsightsSummary(
        anomalies_today=anomalies,
        first_to_break=breakers,
        quiet_but_important=quiet,
        coverage_gaps=gaps,
    )
