"""Prefect flow + standalone runner that assigns unassigned articles to stories."""

import asyncio

from loguru import logger
from prefect import flow

from app.core.database import AsyncSessionLocal
from app.services.clustering import assign_articles_to_stories


@flow(name="cluster_articles", log_prints=True)
async def cluster_articles_flow(batch_size: int = 200, max_batches: int = 50) -> dict:
    """Run the clustering pass in batches until the queue drains or limit hit."""
    total = {"processed": 0, "joined": 0, "new_stories": 0}
    batches = 0
    while batches < max_batches:
        async with AsyncSessionLocal() as session:
            result = await assign_articles_to_stories(session, batch_size=batch_size)
        if result["processed"] == 0:
            break
        total["processed"] += result["processed"]
        total["joined"] += result["joined"]
        total["new_stories"] += result["new_stories"]
        batches += 1
        logger.info(
            f"batch {batches}: processed={result['processed']} "
            f"joined={result['joined']} new={result['new_stories']}"
        )
    logger.info(f"clustering done: {total} across {batches} batches")
    return total


if __name__ == "__main__":
    asyncio.run(cluster_articles_flow())
