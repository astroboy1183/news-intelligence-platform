"""Sources endpoints + ingestion health."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, IngestionRun, Source
from app.schemas.common import Page
from app.schemas.source import SourceHealthSummary, SourceItem
from app.services.coverage import check_source_coverage

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=Page[SourceItem])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    country: str | None = Query(None, min_length=2, max_length=2),
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[SourceItem]:
    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    last_run_subq = (
        select(IngestionRun.source_id, IngestionRun.status)
        .distinct(IngestionRun.source_id)
        .order_by(IngestionRun.source_id, IngestionRun.started_at.desc())
        .subquery()
    )

    art_count_subq = (
        select(Article.source_id, func.count().label("c"))
        .where(Article.fetched_at >= cutoff_24h)
        .group_by(Article.source_id)
        .subquery()
    )

    q = (
        select(Source, art_count_subq.c.c, last_run_subq.c.status)
        .outerjoin(art_count_subq, art_count_subq.c.source_id == Source.id)
        .outerjoin(last_run_subq, last_run_subq.c.source_id == Source.id)
    )
    if country:
        q = q.where(Source.country == country.upper())
    if active_only:
        q = q.where(Source.is_active.is_(True))
    q = q.order_by(Source.country, Source.name)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        SourceItem(
            slug=s.slug, name=s.name, url=s.url, country=s.country,
            region=s.region, region_bucket=s.region_bucket,
            political_lean=s.political_lean, tier=s.tier, is_active=s.is_active,
            last_fetched_at=s.last_fetched_at,
            articles_24h=int(art_count or 0),
            last_run_status=run_status,
        )
        for (s, art_count, run_status) in rows
    ]
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/health", response_model=SourceHealthSummary)
async def source_health(db: AsyncSession = Depends(get_db)) -> SourceHealthSummary:
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    cutoff_24h = now - timedelta(hours=24)

    active = (await db.execute(
        select(func.count()).where(Source.is_active.is_(True))
    )).scalar_one()
    total = (await db.execute(select(func.count()).select_from(Source))).scalar_one()

    healthy = (await db.execute(
        select(func.count()).where(
            Source.is_active.is_(True), Source.last_fetched_at >= one_hour_ago
        )
    )).scalar_one()
    stale = (await db.execute(
        select(func.count()).where(
            Source.is_active.is_(True), Source.last_fetched_at < one_hour_ago
        )
    )).scalar_one()

    # Sources whose most-recent run status is 'error'
    last_run_subq = (
        select(IngestionRun.source_id, IngestionRun.status)
        .distinct(IngestionRun.source_id)
        .order_by(IngestionRun.source_id, IngestionRun.started_at.desc())
        .subquery()
    )
    failing = (await db.execute(
        select(func.count())
        .select_from(Source)
        .join(last_run_subq, last_run_subq.c.source_id == Source.id)
        .where(Source.is_active.is_(True), last_run_subq.c.status == "error")
    )).scalar_one()

    articles_in_window = (await db.execute(
        select(func.count(Article.id)).where(Article.fetched_at >= cutoff_24h)
    )).scalar_one()

    last_run_at = (await db.execute(
        select(func.max(IngestionRun.started_at))
    )).scalar_one()

    return SourceHealthSummary(
        active=int(active), total=int(total),
        healthy=int(healthy), stale=int(stale), failing=int(failing),
        articles_per_hour=float(articles_in_window) / 24.0,
        last_run_at=last_run_at,
    )


@router.get("/{slug}/coverage")
async def coverage(slug: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Compare the source's live feed against our DB. Returns any URLs we don't have."""
    report = await check_source_coverage(db, slug)
    if report is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "source_slug": report.source_slug,
        "raw_in_feed": report.raw_in_feed,
        "unique_in_feed": report.unique_in_feed,
        "in_db": report.in_db,
        "coverage_pct": round(report.coverage_pct, 3),
        "missing": report.missing,
    }
