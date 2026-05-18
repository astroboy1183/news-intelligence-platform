"""Article persistence + dedup."""

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article
from app.services.rss_fetcher import ParsedEntry
from app.services.url_canonical import canonicalize_url, title_hash, url_hash


async def insert_articles_skip_dups(
    session: AsyncSession,
    source_id: int,
    entries: list[ParsedEntry],
) -> tuple[int, int]:
    """Insert entries with ON CONFLICT DO NOTHING on url_hash. Returns (inserted, skipped)."""
    if not entries:
        return 0, 0

    rows: list[dict] = []
    seen_hashes: set[str] = set()
    for entry in entries:
        hash_value = url_hash(entry.url)
        if hash_value in seen_hashes:
            continue
        seen_hashes.add(hash_value)
        title = (entry.title or "").strip()
        rows.append(
            {
                "source_id": source_id,
                "url": canonicalize_url(entry.url)[:2000],
                "url_hash": hash_value,
                "title": title[:1000] or "(untitled)",
                "title_hash": title_hash(title),
                "lead": entry.lead,
                "author": (entry.author or "")[:500] or None,
                "published_at": entry.published_at,
            }
        )

    if not rows:
        return 0, len(entries)

    stmt = pg_insert(Article).values(rows).on_conflict_do_nothing(index_elements=["url_hash"])
    result = await session.execute(stmt)
    inserted = result.rowcount or 0
    skipped = len(entries) - inserted
    return inserted, skipped
