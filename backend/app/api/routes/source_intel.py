"""Source intelligence: breaking power + source overlap matrix."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
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


class CompareSourceInfo(BaseModel):
    slug: str
    name: str
    country: str
    total_stories: int


class CompareStoryItem(BaseModel):
    id: int
    slug: str
    name: str
    source_count: int


class CompareResult(BaseModel):
    a: CompareSourceInfo
    b: CompareSourceInfo
    shared_count: int
    a_only_count: int
    b_only_count: int
    jaccard: float
    shared: list[CompareStoryItem]
    a_only: list[CompareStoryItem]
    b_only: list[CompareStoryItem]


@router.get("/compare", response_model=CompareResult)
async def compare_sources(
    a: str = Query(..., min_length=1),
    b: str = Query(..., min_length=1),
    days: int = Query(30, ge=1, le=120),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> CompareResult:
    """Two-source drill-down: what they agree on vs what each missed.

    Powers the source-comparison matrix on the dashboard — instead of just
    showing 'Jaccard = 0.42', users can click two outlets and see the actual
    stories that drive (or don't drive) the overlap.
    """
    if a == b:
        raise HTTPException(status_code=400, detail="Pick two different sources to compare")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    src_rows = (await db.execute(
        select(Source.id, Source.slug, Source.name, Source.country)
        .where(Source.slug.in_([a, b]))
    )).all()
    by_slug = {slug: (sid, name, country) for (sid, slug, name, country) in src_rows}
    if a not in by_slug or b not in by_slug:
        raise HTTPException(status_code=404, detail="One or both source slugs not found")
    a_id, a_name, a_country = by_slug[a]
    b_id, b_name, b_country = by_slug[b]

    # Per-source story_id sets within the window.
    set_stmt = (
        select(Article.source_id, Article.story_id)
        .where(
            Article.fetched_at >= cutoff,
            Article.story_id.is_not(None),
            Article.source_id.in_([a_id, b_id]),
        )
        .distinct()
    )
    a_set: set[int] = set()
    b_set: set[int] = set()
    for src_id, story_id in (await db.execute(set_stmt)).all():
        (a_set if src_id == a_id else b_set).add(int(story_id))

    shared_ids = a_set & b_set
    a_only_ids = a_set - b_set
    b_only_ids = b_set - a_set
    union = len(a_set) + len(b_set) - len(shared_ids)
    jaccard = len(shared_ids) / union if union else 0.0

    async def top_stories(ids: set[int]) -> list[CompareStoryItem]:
        if not ids:
            return []
        rows = (await db.execute(
            select(Story.id, Story.slug, Story.name, Story.source_count)
            .where(Story.id.in_(ids))
            .order_by(Story.source_count.desc(), Story.last_updated_at.desc())
            .limit(limit)
        )).all()
        return [
            CompareStoryItem(id=sid, slug=slug, name=name, source_count=int(sc))
            for (sid, slug, name, sc) in rows
        ]

    shared = await top_stories(shared_ids)
    a_only = await top_stories(a_only_ids)
    b_only = await top_stories(b_only_ids)

    return CompareResult(
        a=CompareSourceInfo(slug=a, name=a_name, country=a_country, total_stories=len(a_set)),
        b=CompareSourceInfo(slug=b, name=b_name, country=b_country, total_stories=len(b_set)),
        shared_count=len(shared_ids),
        a_only_count=len(a_only_ids),
        b_only_count=len(b_only_ids),
        jaccard=round(jaccard, 3),
        shared=shared,
        a_only=a_only,
        b_only=b_only,
    )
