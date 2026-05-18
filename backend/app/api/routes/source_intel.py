"""Source intelligence: breaking power + source overlap matrix."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, Source, Story
from app.schemas.intelligence import BreakingPowerItem, SourceOverlapRow

router = APIRouter(prefix="/sources/intelligence", tags=["source-intelligence"])


@router.get("/breaking", response_model=list[BreakingPowerItem])
async def breaking(
    db: AsyncSession = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
) -> list[BreakingPowerItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(
        select(Source.slug, Source.name, func.count(Story.id))
        .join(Story, Story.first_reported_by_source_id == Source.id)
        .where(Story.first_seen_at >= cutoff)
        .group_by(Source.slug, Source.name)
        .order_by(desc(func.count(Story.id)))
        .limit(limit)
    )).all()
    return [BreakingPowerItem(slug=s, name=n, stories_broken=int(c)) for (s, n, c) in rows]


@router.get("/overlap", response_model=list[SourceOverlapRow])
async def overlap(
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=120),
    limit: int = Query(50, ge=1, le=500),
) -> list[SourceOverlapRow]:
    """Pairwise Jaccard of source story-sets over recent window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    a = Article.__table__.alias("a")
    b = Article.__table__.alias("b")

    # Counts of stories each source covered (denominator helper).
    src_count_stmt = (
        select(Article.source_id, func.count(func.distinct(Article.story_id)).label("c"))
        .where(Article.fetched_at >= cutoff, Article.story_id.is_not(None))
        .group_by(Article.source_id)
    )
    src_counts = {sid: int(c) for sid, c in (await db.execute(src_count_stmt)).all()}
    if not src_counts:
        return []

    # Pairwise shared story counts.
    pair_stmt = (
        select(a.c.source_id, b.c.source_id, func.count(func.distinct(a.c.story_id)).label("shared"))
        .select_from(
            a.join(b, (a.c.story_id == b.c.story_id) & (a.c.source_id < b.c.source_id))
        )
        .where(a.c.fetched_at >= cutoff, a.c.story_id.is_not(None))
        .group_by(a.c.source_id, b.c.source_id)
        .order_by(desc("shared"))
        .limit(limit * 4)
    )
    pair_rows = (await db.execute(pair_stmt)).all()

    src_slug_stmt = select(Source.id, Source.slug).where(Source.id.in_(src_counts.keys()))
    slug_by_id = {sid: slug for sid, slug in (await db.execute(src_slug_stmt)).all()}

    rows: list[SourceOverlapRow] = []
    for sa, sb, shared in pair_rows:
        union = src_counts.get(sa, 0) + src_counts.get(sb, 0) - int(shared)
        if union == 0:
            continue
        j = int(shared) / union
        rows.append(SourceOverlapRow(
            a_slug=slug_by_id.get(sa, str(sa)),
            b_slug=slug_by_id.get(sb, str(sb)),
            overlap=round(j, 3),
            shared_stories=int(shared),
        ))
    rows.sort(key=lambda r: r.overlap, reverse=True)
    return rows[:limit]
