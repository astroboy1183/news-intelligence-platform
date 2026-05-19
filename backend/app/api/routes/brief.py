"""Daily brief endpoint."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Anomaly, Story
from app.schemas.intelligence import AnomalyItem, BriefDailyPoint, BriefSummary

router = APIRouter(prefix="/brief", tags=["brief"])


@router.get("/today", response_model=BriefSummary)
async def today(db: AsyncSession = Depends(get_db)) -> BriefSummary:
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now - timedelta(hours=48)
    cutoff_7d = now - timedelta(days=7)

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

    # Prior 24h (yesterday) for delta arrows on the cards. Same shape as
    # whats_changed so the frontend can do percentage math without a switch.
    new_prev = (await db.execute(
        select(func.count()).where(
            Story.first_seen_at >= cutoff_48h,
            Story.first_seen_at < cutoff_24h,
        )
    )).scalar_one()
    escalated_prev = (await db.execute(
        select(func.count()).where(
            Story.last_updated_at >= cutoff_48h,
            Story.last_updated_at < cutoff_24h,
            Story.first_seen_at < cutoff_48h,
            Story.source_count >= 5,
        )
    )).scalar_one()
    resolved_prev = (await db.execute(
        select(func.count()).where(
            Story.last_updated_at < cutoff_48h,
            Story.last_updated_at >= cutoff_48h - timedelta(hours=24),
        )
    )).scalar_one()

    # 7-day series for sparklines. One row per day, computed in a single
    # group-by so we don't fan out 14 round trips.
    new_series_stmt = (
        select(
            func.date_trunc("day", Story.first_seen_at).label("d"),
            func.count(Story.id).label("c"),
        )
        .where(Story.first_seen_at >= cutoff_7d)
        .group_by("d")
        .order_by("d")
    )
    new_by_day: dict[str, int] = {
        d.date().isoformat(): int(c)
        for d, c in (await db.execute(new_series_stmt)).all()
    }

    esc_series_stmt = (
        select(
            func.date_trunc("day", Story.last_updated_at).label("d"),
            func.count(Story.id).label("c"),
        )
        .where(
            Story.last_updated_at >= cutoff_7d,
            Story.source_count >= 5,
        )
        .group_by("d")
        .order_by("d")
    )
    esc_by_day: dict[str, int] = {
        d.date().isoformat(): int(c)
        for d, c in (await db.execute(esc_series_stmt)).all()
    }

    daily_series = [
        BriefDailyPoint(
            bucket=(now.date() - timedelta(days=6 - i)).isoformat(),
            new_stories=new_by_day.get((now.date() - timedelta(days=6 - i)).isoformat(), 0),
            escalated=esc_by_day.get((now.date() - timedelta(days=6 - i)).isoformat(), 0),
        )
        for i in range(7)
    ]

    return BriefSummary(
        generated_at=now,
        top_stories=top_stories,
        whats_changed={
            "new": int(new_count),
            "escalated": int(escalated_count),
            "resolved": int(resolved_count),
        },
        whats_changed_prev={
            "new": int(new_prev),
            "escalated": int(escalated_prev),
            "resolved": int(resolved_prev),
        },
        daily_series=daily_series,
        anomalies=anomalies,
        regional_pulse=regional,
    )
