"""Refresh entity_cooccurrence rolling-window snapshot for the network graph."""

from datetime import date, datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article, ArticleEntity, EntityCooccurrence

DEFAULT_WINDOW_DAYS = 7
MIN_COCOUNT = 3


async def refresh_cooccurrence(
    session: AsyncSession,
    *,
    window_days: int = DEFAULT_WINDOW_DAYS,
) -> dict:
    """Compute (entity_a, entity_b, count) over the last window_days. Upsert into table."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
    window_start = date.today() - timedelta(days=window_days)

    a = ArticleEntity.__table__.alias("a")
    b = ArticleEntity.__table__.alias("b")
    stmt = (
        select(
            a.c.entity_id.label("ea"),
            b.c.entity_id.label("eb"),
            func.count().label("c"),
        )
        .select_from(
            a.join(b, (a.c.article_id == b.c.article_id) & (a.c.entity_id < b.c.entity_id))
            .join(Article, Article.id == a.c.article_id)
        )
        .where(Article.fetched_at >= cutoff)
        .group_by(a.c.entity_id, b.c.entity_id)
        .having(func.count() >= MIN_COCOUNT)
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return {"pairs": 0}

    values = [
        {"entity_a_id": ea, "entity_b_id": eb, "window_start": window_start, "count": int(c)}
        for ea, eb, c in rows
    ]
    pg = pg_insert(EntityCooccurrence).values(values)
    pg = pg.on_conflict_do_update(
        index_elements=["entity_a_id", "entity_b_id", "window_start"],
        set_={"count": pg.excluded["count"]},
    )
    await session.execute(pg)
    await session.commit()
    logger.info(f"cooccurrence refresh: {len(rows)} pairs for window starting {window_start}")
    return {"pairs": len(rows), "window_start": window_start.isoformat()}
