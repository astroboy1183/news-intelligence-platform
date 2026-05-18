"""Prefect flow + standalone runner that builds names/TL;DRs/state tags for recent stories."""

import asyncio

from prefect import flow

from app.core.database import AsyncSessionLocal
from app.services.story_builder import build_stories


@flow(name="build_stories", log_prints=True)
async def build_stories_flow() -> dict:
    async with AsyncSessionLocal() as session:
        return await build_stories(session)


if __name__ == "__main__":
    asyncio.run(build_stories_flow())
