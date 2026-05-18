"""Daily brief endpoint."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Anomaly, Story
from app.schemas.intelligence import AnomalyItem, BriefSummary

router = APIRouter(prefix="/brief", tags=["brief"])


@router.get("/today", response_model=BriefSummary)
async def today(db: AsyncSession = Depends(get_db)) -> BriefSummary:
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now - timedelta(hours=48)

    top_stmt = (
        select(Story)
        .where(Story.last_updated_at >= cutoff_24h, Story.source_count >= 3)
        .order_by(Story.source_count.desc(), Story.velocity_score.desc())
        .limit(5)
    )
    top_stories = [
        {
            "id": s.id, "slug": s.slug, "name": s.name,
            "source_count": s.source_count,
            "tldr": list(s.tldr or []),
            "primary_country": s.primary_country,
            "primary_state": s.primary_state,
        }
        for s in (await db.execute(top_stmt)).scalars().all()
    ]

    new_count = (await db.execute(
        select(func.count()).where(Story.first_seen_at >= cutoff_24h)
    )).scalar_one()
    escalated_count = (await db.execute(
        select(func.count()).where(
            Story.last_updated_at >= cutoff_24h,
            Story.first_seen_at < cutoff_24h,
            Story.source_count >= 5,
        )
    )).scalar_one()
    resolved_count = (await db.execute(
        select(func.count()).where(
            Story.last_updated_at < cutoff_24h,
            Story.last_updated_at >= cutoff_48h,
        )
    )).scalar_one()

    anomaly_rows = (await db.execute(
        select(Anomaly).where(Anomaly.detected_at >= cutoff_24h)
        .order_by(Anomaly.severity.desc()).limit(8)
    )).scalars().all()
    anomalies = [
        AnomalyItem(
            id=a.id, type=a.type, severity=a.severity, detected_at=a.detected_at,
            label=a.type, href=None, payload=dict(a.payload or {}),
        )
        for a in anomaly_rows
    ]

    state_rows = (await db.execute(
        select(Story.primary_state, func.count(Story.id))
        .where(
            Story.primary_country == "IN",
            Story.primary_state.is_not(None),
            Story.last_updated_at >= cutoff_24h,
        )
        .group_by(Story.primary_state)
        .order_by(func.count(Story.id).desc())
        .limit(8)
    )).all()
    regional = [{"state": s, "stories_24h": int(c)} for s, c in state_rows]

    return BriefSummary(
        generated_at=now,
        top_stories=top_stories,
        whats_changed={
            "new": int(new_count),
            "escalated": int(escalated_count),
            "resolved": int(resolved_count),
        },
        anomalies=anomalies,
        regional_pulse=regional,
    )
