"""Prefect flow + standalone runner that enriches unenriched articles."""

import asyncio

from loguru import logger
from prefect import flow

from app.core.database import AsyncSessionLocal
from app.services.enrichment import enrich_articles, fetch_unenriched_articles


@flow(name="enrich_articles", log_prints=True)
async def enrich_articles_flow(batch_size: int = 100, max_batches: int = 50) -> dict:
    """Process unenriched articles in batches until the queue is drained or limit hit."""
    total = 0
    batches = 0
    while batches < max_batches:
        async with AsyncSessionLocal() as session:
            articles = await fetch_unenriched_articles(session, limit=batch_size)
            if not articles:
                break
            results = await enrich_articles(session, articles)
        total += len(results)
        batches += 1
        logger.info(f"batch {batches}: {len(results)} articles (total {total})")
    logger.info(f"enrichment done: {total} articles across {batches} batches")
    return {"articles_enriched": total, "batches": batches}


if __name__ == "__main__":
    asyncio.run(enrich_articles_flow())
