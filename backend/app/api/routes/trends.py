"""Trends + map endpoints (time series for topics, state rollups)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, ArticleTopic, Source, Story, Topic
from app.schemas.intelligence import StateRollup, TrendPoint, TrendSeries

router = APIRouter(prefix="/trends", tags=["trends"])


@router.get("/topics", response_model=list[TrendSeries])
async def topic_trends(
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=30),
    top_n: int = Query(8, ge=1, le=20),
) -> list[TrendSeries]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Top N topics by total article count in the window.
    top_stmt = (
        select(Topic.id, Topic.slug, Topic.name, func.count(ArticleTopic.article_id).label("c"))
        .join(ArticleTopic, ArticleTopic.topic_id == Topic.id)
        .join(Article, Article.id == ArticleTopic.article_id)
        .where(Article.fetched_at >= cutoff)
        .group_by(Topic.id, Topic.slug, Topic.name)
        .order_by(func.count(ArticleTopic.article_id).desc())
        .limit(top_n)
    )
    top_topics = (await db.execute(top_stmt)).all()
    if not top_topics:
        return []

    topic_ids = [t[0] for t in top_topics]
    series_stmt = (
        select(
            ArticleTopic.topic_id,
            func.date_trunc("day", Article.fetched_at).label("bucket"),
            func.count(),
        )
        .join(Article, Article.id == ArticleTopic.article_id)
        .where(
            ArticleTopic.topic_id.in_(topic_ids),
            Article.fetched_at >= cutoff,
        )
        .group_by(ArticleTopic.topic_id, "bucket")
        .order_by("bucket")
    )
    rows = (await db.execute(series_stmt)).all()

    bucketed: dict[int, list[TrendPoint]] = {tid: [] for tid in topic_ids}
    for tid, bucket, count in rows:
        bucketed[int(tid)].append(TrendPoint(bucket=bucket.isoformat(), count=int(count)))

    return [
        TrendSeries(name=name, slug=slug, points=bucketed.get(tid, []))
        for (tid, slug, name, _c) in top_topics
    ]


@router.get("/by-state", response_model=list[StateRollup])
async def by_state(
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=30),
) -> list[StateRollup]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(Story.primary_state, func.count(Story.id))
        .where(
            Story.primary_country == "IN",
            Story.primary_state.is_not(None),
            Story.last_updated_at >= cutoff,
        )
        .group_by(Story.primary_state)
        .order_by(func.count(Story.id).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [StateRollup(state=s, code=None, story_count=int(c)) for (s, c) in rows]
