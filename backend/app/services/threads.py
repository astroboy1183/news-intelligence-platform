"""Thread detection: link related multi-day stories into ongoing narratives.

Algorithm:
  For each story currently not in a thread, find the best candidate thread by
  Jaccard overlap on top entities + topics, within a temporal window. If
  overlap exceeds threshold, attach story to thread. Otherwise, if the story
  has enough coverage (≥3 outlets), seed a new thread.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Article,
    ArticleEntity,
    ArticleTopic,
    Entity,
    Story,
    Thread,
    ThreadStory,
    Topic,
)
from app.services.text_utils import slugify

THREAD_WINDOW_DAYS = 14
OVERLAP_THRESHOLD = 0.30
MIN_SOURCES_TO_SEED_THREAD = 3
TOP_ENTITIES_PER_STORY = 8
TOP_TOPICS_PER_STORY = 6


async def _story_entity_set(session: AsyncSession, story_id: int) -> frozenset[int]:
    stmt = (
        select(ArticleEntity.entity_id, func.sum(ArticleEntity.mention_count).label("c"))
        .join(Article, Article.id == ArticleEntity.article_id)
        .where(Article.story_id == story_id)
        .group_by(ArticleEntity.entity_id)
        .order_by(func.sum(ArticleEntity.mention_count).desc())
        .limit(TOP_ENTITIES_PER_STORY)
    )
    res = await session.execute(stmt)
    return frozenset(r[0] for r in res.all())


async def _story_topic_set(session: AsyncSession, story_id: int) -> frozenset[int]:
    stmt = (
        select(ArticleTopic.topic_id, func.avg(ArticleTopic.score).label("s"))
        .join(Article, Article.id == ArticleTopic.article_id)
        .where(Article.story_id == story_id)
        .group_by(ArticleTopic.topic_id)
        .order_by(func.avg(ArticleTopic.score).desc())
        .limit(TOP_TOPICS_PER_STORY)
    )
    res = await session.execute(stmt)
    return frozenset(r[0] for r in res.all())


def _jaccard(a: frozenset[int], b: frozenset[int]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


async def _active_threads_in_window(session: AsyncSession) -> list[Thread]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=THREAD_WINDOW_DAYS)
    res = await session.execute(
        select(Thread).where(Thread.last_updated_at >= cutoff, Thread.status == "active")
    )
    return list(res.scalars().all())


async def _thread_top_sets(
    session: AsyncSession, thread_id: int
) -> tuple[frozenset[int], frozenset[int]]:
    """Aggregate top entities/topics across all stories already in the thread."""
    ent_stmt = (
        select(ArticleEntity.entity_id, func.sum(ArticleEntity.mention_count))
        .join(Article, Article.id == ArticleEntity.article_id)
        .join(ThreadStory, ThreadStory.story_id == Article.story_id)
        .where(ThreadStory.thread_id == thread_id)
        .group_by(ArticleEntity.entity_id)
        .order_by(func.sum(ArticleEntity.mention_count).desc())
        .limit(TOP_ENTITIES_PER_STORY * 2)
    )
    ents = frozenset(r[0] for r in (await session.execute(ent_stmt)).all())
    top_stmt = (
        select(ArticleTopic.topic_id, func.avg(ArticleTopic.score))
        .join(Article, Article.id == ArticleTopic.article_id)
        .join(ThreadStory, ThreadStory.story_id == Article.story_id)
        .where(ThreadStory.thread_id == thread_id)
        .group_by(ArticleTopic.topic_id)
        .order_by(func.avg(ArticleTopic.score).desc())
        .limit(TOP_TOPICS_PER_STORY * 2)
    )
    tops = frozenset(r[0] for r in (await session.execute(top_stmt)).all())
    return ents, tops


async def _unthreaded_stories(session: AsyncSession, limit: int = 500) -> list[Story]:
    """Stories with ≥2 outlets, not yet in a thread, ordered most recent first."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=THREAD_WINDOW_DAYS)
    stmt = (
        select(Story)
        .where(
            Story.thread_id.is_(None),
            Story.source_count >= 2,
            Story.last_updated_at >= cutoff,
        )
        .order_by(Story.last_updated_at.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def detect_threads(session: AsyncSession, batch_size: int = 500) -> dict:
    """One pass of thread detection."""
    stories = await _unthreaded_stories(session, batch_size)
    if not stories:
        return {"processed": 0, "joined": 0, "new_threads": 0}

    # Precompute thread "signatures" once per pass.
    threads = await _active_threads_in_window(session)
    thread_sigs: dict[int, tuple[frozenset[int], frozenset[int]]] = {}
    for t in threads:
        thread_sigs[t.id] = await _thread_top_sets(session, t.id)

    joined = 0
    new_threads = 0
    for story in stories:
        story_ents = await _story_entity_set(session, story.id)
        story_tops = await _story_topic_set(session, story.id)
        if not story_ents and not story_tops:
            continue

        best_thread_id: int | None = None
        best_score = 0.0
        for tid, (ents, tops) in thread_sigs.items():
            ent_j = _jaccard(story_ents, ents)
            top_j = _jaccard(story_tops, tops)
            score = 0.7 * ent_j + 0.3 * top_j
            if score > best_score:
                best_score = score
                best_thread_id = tid

        if best_thread_id is not None and best_score >= OVERLAP_THRESHOLD:
            session.add(
                ThreadStory(thread_id=best_thread_id, story_id=story.id, role="escalation")
            )
            await session.execute(
                update(Story).where(Story.id == story.id).values(thread_id=best_thread_id)
            )
            await session.execute(
                update(Thread)
                .where(Thread.id == best_thread_id)
                .values(
                    last_updated_at=story.last_updated_at,
                    story_count=Thread.story_count + 1,
                )
            )
            # Update signature cache so subsequent stories see the new context.
            ents, tops = thread_sigs[best_thread_id]
            thread_sigs[best_thread_id] = (ents | story_ents, tops | story_tops)
            joined += 1
        elif story.source_count >= MIN_SOURCES_TO_SEED_THREAD:
            slug = f"{slugify(story.name[:60])}-t{story.id}"
            thread = Thread(
                slug=slug,
                name=story.name[:500],
                first_seen_at=story.first_seen_at,
                last_updated_at=story.last_updated_at,
                story_count=1,
                status="active",
                velocity_history=[],
            )
            session.add(thread)
            await session.flush()
            session.add(ThreadStory(thread_id=thread.id, story_id=story.id, role="origin"))
            await session.execute(
                update(Story).where(Story.id == story.id).values(thread_id=thread.id)
            )
            thread_sigs[thread.id] = (story_ents, story_tops)
            new_threads += 1

    await session.commit()
    logger.info(
        f"thread detection: processed={len(stories)} joined={joined} new={new_threads}"
    )
    return {"processed": len(stories), "joined": joined, "new_threads": new_threads}
