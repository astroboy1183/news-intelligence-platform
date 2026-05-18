"""Idempotent seeder for sources + Indian states.

Usage:
    python -m app.seed.run_seed
"""

import asyncio

from loguru import logger
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal
from app.models import IndianState, Source
from app.seed.indian_states import INDIAN_STATES
from app.seed.sources import SOURCES


async def upsert_sources() -> int:
    """Upsert all sources. Note: deliberately does NOT touch `is_active`, so
    per-source deactivations (set via SQL or admin tooling) survive re-seeding.
    To mark a source inactive permanently, edit it in the DB."""
    async with AsyncSessionLocal() as session:
        # Strip optional flags that aren't part of the SQL upsert (e.g. is_active
        # hint in the seed file is documentation only — actual state lives in DB).
        rows = [{k: v for k, v in row.items() if k != "is_active"} for row in SOURCES]
        stmt = pg_insert(Source).values(rows)
        update_cols = {
            c: stmt.excluded[c]
            for c in (
                "name", "url", "rss_url", "country", "region", "language",
                "tier", "political_lean", "region_bucket",
            )
        }
        stmt = stmt.on_conflict_do_update(index_elements=["slug"], set_=update_cols)
        await session.execute(stmt)
        await session.commit()
    return len(SOURCES)


async def upsert_states() -> int:
    async with AsyncSessionLocal() as session:
        stmt = pg_insert(IndianState).values(INDIAN_STATES)
        stmt = stmt.on_conflict_do_update(
            index_elements=["name"],
            set_={"code": stmt.excluded["code"], "aliases": stmt.excluded["aliases"]},
        )
        await session.execute(stmt)
        await session.commit()
    return len(INDIAN_STATES)


async def main() -> None:
    logger.info("seeding sources...")
    n_sources = await upsert_sources()
    logger.info(f"upserted {n_sources} sources")

    logger.info("seeding indian states...")
    n_states = await upsert_states()
    logger.info(f"upserted {n_states} states/UTs")


if __name__ == "__main__":
    asyncio.run(main())
