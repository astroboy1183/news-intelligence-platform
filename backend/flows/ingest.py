"""Prefect flow + standalone runner that ingests all active RSS sources concurrently."""

import asyncio
from collections import Counter

import httpx
from loguru import logger
from prefect import flow
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import Source


async def _list_active_source_ids() -> list[int]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Source.id).where(Source.is_active.is_(True)).order_by(Source.id)
        )
        return [row[0] for row in result.all()]


@flow(name="ingest_all_sources", log_prints=True)
async def ingest_all_sources_flow() -> dict:
    """Fan out RSS fetches across all active sources. Scheduled every 2 min in production."""
    # Imported here to keep flow module importable without DB at registration time.
    from app.services.ingestion import ingest_one_source

    source_ids = await _list_active_source_ids()
    logger.info(f"starting ingestion for {len(source_ids)} active sources")

    timeout = httpx.Timeout(settings.fetch_timeout_seconds, connect=5.0)
    limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
    async with httpx.AsyncClient(timeout=timeout, limits=limits, http2=False) as client:
        tasks = [ingest_one_source(client, sid) for sid in source_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    status_counts: Counter[str] = Counter()
    total_inserted = 0
    errors: list[tuple[int, str]] = []
    for sid, res in zip(source_ids, results, strict=True):
        if isinstance(res, Exception):
            status_counts["unhandled_exception"] += 1
            errors.append((sid, repr(res)))
            continue
        status_counts[res["status"]] += 1
        total_inserted += res.get("inserted", 0) or 0

    summary = {
        "sources": len(source_ids),
        "total_inserted": total_inserted,
        "status_counts": dict(status_counts),
        "errors": errors[:10],
    }
    logger.info(f"ingestion done: {summary}")
    return summary


if __name__ == "__main__":
    asyncio.run(ingest_all_sources_flow())
