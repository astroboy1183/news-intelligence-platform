"""Per-source ingestion orchestration with per-host concurrency and IngestionRun bookkeeping."""

import asyncio
from datetime import datetime, timezone

import httpx
import tldextract
from loguru import logger

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import IngestionRun, Source
from app.services.article_repo import insert_articles_skip_dups
from app.services.rss_fetcher import fetch_feed

# Process-global per-host semaphore registry — keeps us from hammering one domain.
_host_semaphores: dict[str, asyncio.Semaphore] = {}
_registry_lock = asyncio.Lock()


async def _semaphore_for(url: str, max_per_host: int) -> asyncio.Semaphore:
    parts = tldextract.extract(url)
    host = ".".join(p for p in (parts.domain, parts.suffix) if p) or url
    async with _registry_lock:
        sem = _host_semaphores.get(host)
        if sem is None:
            sem = asyncio.Semaphore(max_per_host)
            _host_semaphores[host] = sem
    return sem


async def ingest_one_source(client: httpx.AsyncClient, source_id: int) -> dict:
    """Fetch one source, dedup, insert. Records an IngestionRun. Returns a small summary dict."""
    max_per_host = settings.per_host_concurrency

    async with AsyncSessionLocal() as session:
        source = await session.get(Source, source_id)
        if source is None or not source.is_active:
            return {"source_id": source_id, "status": "skipped_inactive"}
        sem = await _semaphore_for(source.rss_url, max_per_host)

    async with sem, AsyncSessionLocal() as session:
        source = await session.get(Source, source_id)
        if source is None:
            return {"source_id": source_id, "status": "missing"}

        run = IngestionRun(source_id=source_id, status="running")
        session.add(run)
        await session.flush()

        try:
            result = await fetch_feed(
                client,
                source.rss_url,
                etag=source.last_etag,
                last_modified=source.last_modified,
            )
        except Exception as exc:
            run.status = "error"
            run.error = str(exc)[:1000]
            run.finished_at = datetime.now(timezone.utc)
            await session.commit()
            logger.warning(f"ingest failed for {source.slug}: {exc}")
            return {
                "source_id": source_id, "slug": source.slug,
                "status": "error", "error": str(exc),
            }

        if result.not_modified:
            run.status = "not_modified"
        else:
            inserted, skipped = await insert_articles_skip_dups(
                session, source_id, result.entries
            )
            run.articles_seen = len(result.entries)
            run.articles_inserted = inserted
            run.articles_skipped = skipped
            run.status = "ok"

        source.last_fetched_at = datetime.now(timezone.utc)
        if result.etag:
            source.last_etag = result.etag
        if result.last_modified:
            source.last_modified = result.last_modified
        run.finished_at = datetime.now(timezone.utc)
        await session.commit()

        return {
            "source_id": source_id,
            "slug": source.slug,
            "status": run.status,
            "seen": run.articles_seen,
            "inserted": run.articles_inserted,
        }
