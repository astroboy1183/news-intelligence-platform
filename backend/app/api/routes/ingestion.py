"""Ingestion observability + manual trigger.

GET  /ingestion/runs     paginated list of recent runs joined with source
GET  /ingestion/summary  high-level counters + lock status
POST /ingestion/trigger  fire-and-forget all-source ingestion (idempotent via in-memory flag)
"""

import asyncio
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.models import IngestionRun, Source
from app.schemas.common import Page
from app.schemas.ingestion import IngestionRunItem, IngestionSummary, TriggerResponse

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

# Module-level flag so simultaneous trigger clicks don't fan out duplicate work.
# Per-host semaphores already prevent rate violations; this just avoids wasted CPU.
_ingestion_lock = asyncio.Lock()
_ingestion_running = False


def is_ingestion_running() -> bool:
    return _ingestion_running


async def _run_full_ingestion() -> None:
    """Identical to flows.ingest.ingest_all_sources_flow, just without Prefect overhead."""
    global _ingestion_running
    from app.services.ingestion import ingest_one_source

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(Source.id).where(Source.is_active.is_(True)).order_by(Source.id)
        )).all()
        source_ids = [r[0] for r in rows]

    logger.info(f"manual trigger: starting ingestion for {len(source_ids)} sources")
    timeout = httpx.Timeout(settings.fetch_timeout_seconds, connect=5.0)
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
    try:
        async with httpx.AsyncClient(timeout=timeout, limits=limits, http2=False) as client:
            tasks = [ingest_one_source(client, sid) for sid in source_ids]
            await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("manual trigger: done")
    finally:
        _ingestion_running = False


@router.post("/trigger", response_model=TriggerResponse)
async def trigger_ingestion() -> TriggerResponse:
    global _ingestion_running
    async with _ingestion_lock:
        if _ingestion_running:
            return TriggerResponse(
                status="already_running",
                sources=0,
                message="An ingestion run is already in progress — try again in a moment.",
            )
        _ingestion_running = True

    async with AsyncSessionLocal() as session:
        active = (await session.execute(
            select(func.count()).where(Source.is_active.is_(True))
        )).scalar_one()

    # Fire-and-forget. The task will flip _ingestion_running back to False in its finally.
    asyncio.create_task(_run_full_ingestion())
    return TriggerResponse(
        status="started",
        sources=int(active),
        message=f"Ingestion started across {int(active)} active sources.",
    )


@router.get("/runs", response_model=Page[IngestionRunItem])
async def list_runs(
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
    source_slug: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[IngestionRunItem]:
    q = (
        select(IngestionRun, Source.slug, Source.name)
        .join(Source, Source.id == IngestionRun.source_id)
    )
    if status:
        q = q.where(IngestionRun.status == status)
    if source_slug:
        q = q.where(Source.slug == source_slug)
    q = q.order_by(desc(IngestionRun.started_at))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).all()
    items: list[IngestionRunItem] = []
    for run, slug, name in rows:
        duration_ms = None
        if run.finished_at:
            duration_ms = int((run.finished_at - run.started_at).total_seconds() * 1000)
        items.append(IngestionRunItem(
            id=run.id, source_slug=slug, source_name=name,
            status=run.status,
            started_at=run.started_at, finished_at=run.finished_at,
            duration_ms=duration_ms,
            articles_seen=run.articles_seen,
            articles_inserted=run.articles_inserted,
            articles_skipped=run.articles_skipped,
            error=run.error,
        ))
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/summary", response_model=IngestionSummary)
async def summary(db: AsyncSession = Depends(get_db)) -> IngestionSummary:
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)
    one_day_ago = now - timedelta(hours=24)

    last_hour = (await db.execute(
        select(func.count()).where(IngestionRun.started_at >= one_hour_ago)
    )).scalar_one()

    counts_24h = (await db.execute(
        select(
            func.count(),
            func.sum(case((IngestionRun.status == "ok", 1), else_=0)),
            func.sum(case((IngestionRun.status == "error", 1), else_=0)),
            func.sum(case((IngestionRun.status == "not_modified", 1), else_=0)),
            func.sum(IngestionRun.articles_inserted),
            func.sum(IngestionRun.articles_skipped),
        ).where(IngestionRun.started_at >= one_day_ago)
    )).one()
    total_24h, ok_24h, err_24h, nm_24h, ins_24h, skip_24h = counts_24h

    avg_duration_stmt = select(
        func.avg(
            func.extract("epoch", IngestionRun.finished_at - IngestionRun.started_at) * 1000
        )
    ).where(
        IngestionRun.started_at >= one_day_ago,
        IngestionRun.finished_at.is_not(None),
    )
    avg_ms_raw = (await db.execute(avg_duration_stmt)).scalar()
    avg_ms = int(float(avg_ms_raw)) if avg_ms_raw is not None else None

    sources_total = (await db.execute(select(func.count()).select_from(Source))).scalar_one()
    sources_active = (await db.execute(
        select(func.count()).where(Source.is_active.is_(True))
    )).scalar_one()
    last_run = (await db.execute(select(func.max(IngestionRun.started_at)))).scalar_one()

    return IngestionSummary(
        runs_last_hour=int(last_hour),
        runs_last_24h=int(total_24h or 0),
        success_count_24h=int(ok_24h or 0),
        error_count_24h=int(err_24h or 0),
        not_modified_24h=int(nm_24h or 0),
        articles_inserted_24h=int(ins_24h or 0),
        articles_skipped_24h=int(skip_24h or 0),
        avg_duration_ms=avg_ms,
        sources_total=int(sources_total),
        sources_active=int(sources_active),
        last_run_at=last_run,
        ingestion_running=is_ingestion_running(),
    )
