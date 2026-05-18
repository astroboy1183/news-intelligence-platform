"""On-demand per-source coverage check.

For a given source, fetch its RSS/HTML feed fresh, then look up every URL in
the DB. Returns:
    in_feed         — how many items the source returned right now
    in_db           — of those, how many we already have
    missing         — list of (url, title) items in the feed that we don't have
    coverage_pct    — in_db / in_feed
"""

from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Article, Source
from app.services.rss_fetcher import fetch_feed
from app.services.url_canonical import url_hash


@dataclass
class CoverageReport:
    source_slug: str
    raw_in_feed: int        # total entries the feed returned (may include dups)
    unique_in_feed: int     # unique-by-canonical-URL items
    in_db: int              # of the unique items, how many are already in our DB
    coverage_pct: float
    missing: list[dict]     # {url, title}


async def check_source_coverage(session: AsyncSession, source_slug: str) -> CoverageReport | None:
    source = (await session.execute(
        select(Source).where(Source.slug == source_slug)
    )).scalar_one_or_none()
    if source is None:
        return None

    timeout = httpx.Timeout(settings.fetch_timeout_seconds, connect=5.0)
    async with httpx.AsyncClient(timeout=timeout, http2=False) as client:
        # Skip conditional GET so we get the full feed regardless of cache state.
        result = await fetch_feed(client, source.rss_url, etag=None, last_modified=None)

    entries = result.entries
    if not entries:
        return CoverageReport(
            source_slug=source.slug,
            raw_in_feed=0, unique_in_feed=0,
            in_db=0, coverage_pct=1.0, missing=[],
        )

    # Compute hashes for every feed URL; duplicate URLs in the feed collapse to one.
    hash_to_entry: dict[str, tuple[str, str]] = {
        url_hash(e.url): (e.url, e.title) for e in entries
    }
    hashes = list(hash_to_entry.keys())

    rows = (await session.execute(
        select(Article.url_hash).where(Article.url_hash.in_(hashes))
    )).all()
    found_hashes = {r[0] for r in rows}

    missing = [
        {"url": url, "title": title}
        for h, (url, title) in hash_to_entry.items()
        if h not in found_hashes
    ]
    unique_count = len(hash_to_entry)
    return CoverageReport(
        source_slug=source.slug,
        raw_in_feed=len(entries),
        unique_in_feed=unique_count,
        in_db=len(found_hashes),
        coverage_pct=len(found_hashes) / unique_count if unique_count else 1.0,
        missing=missing,
    )
