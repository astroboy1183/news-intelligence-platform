"""Tiny asyncio-based scheduler that runs the pipeline tasks on intervals.

Replaces Prefect's serve() for production. Prefect's ephemeral server inside a
container doesn't reliably fire cron schedules. This is a 30-line alternative
that just sleep-loops and calls the same flow functions directly.

Disable per-task via env vars (SCHEDULE_INGEST=false etc.) — useful in dev
where you run flows manually.
"""

import asyncio
import os
from collections.abc import Awaitable, Callable

import httpx
from loguru import logger
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import Source


# ---------- direct callables that skip the @flow wrappers ----------


async def _ingest_all() -> None:
    """Equivalent of flows.ingest.ingest_all_sources_flow without Prefect."""
    from app.services.ingestion import ingest_one_source

    async with AsyncSessionLocal() as session:
        rows = (await session.execute(
            select(Source.id).where(Source.is_active.is_(True)).order_by(Source.id)
        )).all()
        source_ids = [r[0] for r in rows]

    timeout = httpx.Timeout(settings.fetch_timeout_seconds, connect=5.0)
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
    async with httpx.AsyncClient(timeout=timeout, limits=limits, http2=False) as client:
        tasks = [ingest_one_source(client, sid) for sid in source_ids]
        await asyncio.gather(*tasks, return_exceptions=True)


async def _enrich_batch() -> None:
    from app.services.enrichment import enrich_articles, fetch_unenriched_articles

    async with AsyncSessionLocal() as session:
        for _ in range(10):  # cap each tick at 10 batches to avoid hogging
            articles = await fetch_unenriched_articles(session, limit=100)
            if not articles:
                break
            await enrich_articles(session, articles)


async def _cluster_pass() -> None:
    from app.services.clustering import assign_articles_to_stories

    async with AsyncSessionLocal() as session:
        for _ in range(20):
            res = await assign_articles_to_stories(session, batch_size=200)
            if res["processed"] == 0:
                break


async def _build_stories_pass() -> None:
    from app.services.story_builder import build_stories

    async with AsyncSessionLocal() as session:
        await build_stories(session)


async def _intelligence_pass() -> None:
    from app.services.anomalies import detect_all
    from app.services.cooccurrence import refresh_cooccurrence
    from app.services.predictions import backfill_prediction_outcomes, score_predictions
    from app.services.threads import detect_threads

    async with AsyncSessionLocal() as session:
        await detect_threads(session)
        await detect_all(session)
        await score_predictions(session)
        await backfill_prediction_outcomes(session)
        await refresh_cooccurrence(session)


# ---------- loop runner ----------


async def _loop(name: str, interval_seconds: int, fn: Callable[[], Awaitable[None]]) -> None:
    """Run fn on an interval, log timing, swallow exceptions so one bad tick doesn't kill the loop."""
    # Stagger initial run so all tasks don't fire at exactly t=0 and compete.
    await asyncio.sleep(min(interval_seconds, 30))
    while True:
        started = asyncio.get_event_loop().time()
        try:
            await fn()
            elapsed = asyncio.get_event_loop().time() - started
            logger.info(f"scheduler[{name}] ok in {elapsed:.1f}s")
        except Exception as exc:
            logger.exception(f"scheduler[{name}] failed: {exc!r}")
        await asyncio.sleep(interval_seconds)


def _env_enabled(name: str, default: bool = True) -> bool:
    val = os.getenv(name, "true" if default else "false").lower()
    return val in {"1", "true", "yes", "on"}


def start_scheduled_tasks() -> list[asyncio.Task]:
    """Spawn all scheduler loops as asyncio tasks. Return them so caller can cancel."""
    if not _env_enabled("RUN_SCHEDULER", True):
        logger.info("RUN_SCHEDULER=false — in-process scheduler disabled")
        return []

    tasks: list[asyncio.Task] = []
    schedule = [
        ("ingest",        _ingest_all,          120,  "SCHEDULE_INGEST"),
        ("enrich",        _enrich_batch,        300,  "SCHEDULE_ENRICH"),
        ("cluster",       _cluster_pass,        300,  "SCHEDULE_CLUSTER"),
        ("build_stories", _build_stories_pass,  600,  "SCHEDULE_BUILD"),
        ("intelligence",  _intelligence_pass,   1800, "SCHEDULE_INTEL"),
    ]
    for name, fn, interval, env_key in schedule:
        if not _env_enabled(env_key, True):
            logger.info(f"scheduler[{name}] disabled by env")
            continue
        task = asyncio.create_task(_loop(name, interval, fn), name=f"scheduler:{name}")
        tasks.append(task)
        logger.info(f"scheduler[{name}] started — every {interval}s")
    return tasks
