"""Anomaly detection: entity surges, silences, novel entities, story bursts."""

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Anomaly, Article, ArticleEntity, Entity, Source, Story

WINDOW_HOURS = 24
HISTORY_DAYS = 14
Z_SURGE = 2.5
Z_SILENCE = -2.0


async def detect_entity_surges_and_silences(session: AsyncSession) -> int:
    """Compare last-24h entity mentions vs 14-day rolling average → z-score."""
    now = datetime.now(timezone.utc)
    win_start = now - timedelta(hours=WINDOW_HOURS)
    hist_start = now - timedelta(days=HISTORY_DAYS)

    # Per-entity mention counts in the recent window.
    recent_stmt = (
        select(ArticleEntity.entity_id, func.sum(ArticleEntity.mention_count))
        .join(Article, Article.id == ArticleEntity.article_id)
        .where(Article.fetched_at >= win_start)
        .group_by(ArticleEntity.entity_id)
    )
    recent_counts = {eid: int(c) for eid, c in (await session.execute(recent_stmt)).all()}

    # Per-entity daily mention counts over the history window, for mean/std.
    hist_stmt = (
        select(
            ArticleEntity.entity_id,
            func.date_trunc("day", Article.fetched_at).label("d"),
            func.sum(ArticleEntity.mention_count).label("c"),
        )
        .join(Article, Article.id == ArticleEntity.article_id)
        .where(Article.fetched_at >= hist_start, Article.fetched_at < win_start)
        .group_by(ArticleEntity.entity_id, "d")
    )
    daily: dict[int, list[int]] = defaultdict(list)
    for eid, _d, c in (await session.execute(hist_stmt)).all():
        daily[eid].append(int(c))

    inserted = 0
    rows: list[dict] = []
    for eid, recent in recent_counts.items():
        history = daily.get(eid, [])
        if len(history) < 3:
            continue
        mean = sum(history) / len(history)
        var = sum((x - mean) ** 2 for x in history) / len(history)
        std = math.sqrt(var) or 1.0
        z = (recent - mean) / std
        if z >= Z_SURGE:
            rows.append({
                "type": "entity_surge",
                "target_entity_id": eid,
                "severity": float(z),
                "payload": {"recent": recent, "mean": mean, "std": std},
            })
            inserted += 1
        elif z <= Z_SILENCE and mean >= 3:
            rows.append({
                "type": "entity_silence",
                "target_entity_id": eid,
                "severity": float(-z),
                "payload": {"recent": recent, "mean": mean, "std": std},
            })
            inserted += 1

    # Novel entities: zero history but ≥5 mentions in window
    for eid, recent in recent_counts.items():
        if eid not in daily and recent >= 5:
            rows.append({
                "type": "novel_entity",
                "target_entity_id": eid,
                "severity": float(recent),
                "payload": {"recent": recent},
            })
            inserted += 1

    if rows:
        await session.execute(pg_insert(Anomaly).values(rows))
    await session.commit()
    return inserted


async def detect_story_bursts(session: AsyncSession) -> int:
    """Stories that gained ≥5 outlets in the last 4 hours."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=4)
    stmt = (
        select(Story.id, func.count(func.distinct(Article.source_id)).label("recent_sources"))
        .join(Article, Article.story_id == Story.id)
        .where(Article.fetched_at >= cutoff)
        .group_by(Story.id)
        .having(func.count(func.distinct(Article.source_id)) >= 5)
    )
    rows = [
        {
            "type": "story_burst",
            "target_story_id": sid,
            "severity": float(rc),
            "payload": {"recent_sources_4h": int(rc)},
        }
        for sid, rc in (await session.execute(stmt)).all()
    ]
    if rows:
        await session.execute(pg_insert(Anomaly).values(rows))
    await session.commit()
    return len(rows)


async def detect_coverage_gaps(session: AsyncSession) -> int:
    """Stories covered by only one region bucket (India vs global)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    in_count = func.sum(case((Source.country == "IN", 1), else_=0))
    global_count = func.sum(case((Source.country != "IN", 1), else_=0))
    stmt = (
        select(
            Story.id,
            in_count.label("ic"),
            global_count.label("gc"),
        )
        .join(Article, Article.story_id == Story.id)
        .join(Source, Source.id == Article.source_id)
        .where(Article.fetched_at >= cutoff)
        .group_by(Story.id)
        .having(
            (in_count >= 3) & (global_count == 0)
            | (global_count >= 5) & (in_count == 0)
        )
    )
    rows = []
    for sid, ic, gc in (await session.execute(stmt)).all():
        gap = "india_only" if int(ic or 0) > 0 and int(gc or 0) == 0 else "global_only"
        rows.append({
            "type": "coverage_gap",
            "target_story_id": sid,
            "severity": float(ic or 0) + float(gc or 0),
            "payload": {"in": int(ic or 0), "global": int(gc or 0), "gap": gap},
        })
    if rows:
        await session.execute(pg_insert(Anomaly).values(rows))
    await session.commit()
    return len(rows)


async def detect_all(session: AsyncSession) -> dict:
    a = await detect_entity_surges_and_silences(session)
    b = await detect_story_bursts(session)
    c = await detect_coverage_gaps(session)
    logger.info(f"anomalies: entity={a} burst={b} gap={c}")
    return {"entity": a, "story_burst": b, "coverage_gap": c}
