"""Story clustering via pgvector kNN over recently-enriched articles.

Algorithm for each unassigned article a:
  1. kNN search in pgvector for nearest article among the last 48h that has a story_id.
  2. If cosine similarity ≥ threshold → assign a.story_id to that match's story.
  3. Else → create a new Story with a as seed. centroid = a.embedding.
  4. Recompute story.article_count, source_count, last_updated_at, centroid.

We use pgvector's `<=>` operator (cosine distance). similarity = 1 - distance.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import bindparam, func, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Article, Source, Story
from app.services.text_utils import slugify

NEIGHBOR_WINDOW_HOURS = 48


async def _fetch_unassigned_articles(session: AsyncSession, limit: int) -> list[Article]:
    stmt = (
        select(Article)
        .where(Article.embedding.is_not(None), Article.story_id.is_(None))
        .order_by(Article.id)
        .limit(limit)
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def _nearest_story_for(
    session: AsyncSession,
    article: Article,
    *,
    threshold: float,
    window_hours: int = NEIGHBOR_WINDOW_HOURS,
) -> int | None:
    """Return the best matching story_id within window_hours, else None."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)

    # Use pgvector's ORM operator so SQLAlchemy emits the right cast.
    distance = Article.embedding.cosine_distance(article.embedding)
    stmt = (
        select(Article.story_id, (1 - distance).label("similarity"))
        .where(
            Article.story_id.is_not(None),
            Article.embedding.is_not(None),
            Article.fetched_at >= cutoff,
            Article.id != article.id,
        )
        .order_by(distance)
        .limit(1)
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        return None
    story_id, similarity = row
    if similarity is None or float(similarity) < threshold:
        return None
    return int(story_id)


async def _create_new_story(session: AsyncSession, seed_article: Article) -> Story:
    """Create a new Story rooted at this seed article. Name/TL;DR filled later by the builder."""
    base_slug = slugify(seed_article.title[:80])
    # Disambiguate via id suffix.
    slug = f"{base_slug}-{seed_article.id}"
    story = Story(
        slug=slug,
        name=seed_article.title[:500],
        tldr=[],
        centroid_embedding=seed_article.embedding,
        first_seen_at=seed_article.published_at or seed_article.fetched_at,
        last_updated_at=datetime.now(timezone.utc),
        article_count=1,
        source_count=1,
        velocity_score=0.0,
        velocity_history=[],
        first_reported_by_source_id=seed_article.source_id,
    )
    session.add(story)
    await session.flush()  # populate story.id
    return story


async def _recompute_story_stats(session: AsyncSession, story_ids: set[int]) -> None:
    """Update article_count, source_count, last_updated_at, centroid for the given stories.

    last_updated_at is set to now() because this function only runs after new articles
    were just assigned to the story — the story was, by definition, just updated.
    We can't use MAX(published_at) since many sources backdate/syndicate articles with
    stale timestamps, which would prevent last_updated_at from advancing and keep fresh
    stories invisible on the dashboard's trending/recent sorts.
    """
    if not story_ids:
        return
    stmt = text("""
        SELECT story_id,
               COUNT(*) AS article_count,
               COUNT(DISTINCT source_id) AS source_count
        FROM article
        WHERE story_id = ANY(:ids)
        GROUP BY story_id
    """).bindparams(bindparam("ids", value=list(story_ids)))
    rows = (await session.execute(stmt)).all()

    now = datetime.now(timezone.utc)
    for sid, article_count, source_count in rows:
        await session.execute(
            update(Story)
            .where(Story.id == sid)
            .values(
                article_count=int(article_count),
                source_count=int(source_count),
                last_updated_at=now,
            )
        )


async def assign_articles_to_stories(
    session: AsyncSession,
    *,
    batch_size: int = 200,
    threshold: float | None = None,
) -> dict:
    """One pass: pull unassigned articles, route each to an existing or new story."""
    threshold = threshold if threshold is not None else settings.cluster_similarity_threshold
    articles = await _fetch_unassigned_articles(session, batch_size)
    if not articles:
        return {"processed": 0, "joined": 0, "new_stories": 0}

    touched_stories: set[int] = set()
    joined = 0
    new_stories = 0

    for article in articles:
        nearest_id = await _nearest_story_for(session, article, threshold=threshold)
        if nearest_id is not None:
            article.story_id = nearest_id
            touched_stories.add(nearest_id)
            joined += 1
        else:
            story = await _create_new_story(session, article)
            article.story_id = story.id
            touched_stories.add(story.id)
            new_stories += 1
        session.add(article)
        # Flush often so subsequent kNN searches can find the just-assigned article.
        await session.flush()

    await _recompute_story_stats(session, touched_stories)
    await session.commit()

    return {
        "processed": len(articles),
        "joined": joined,
        "new_stories": new_stories,
        "touched_stories": len(touched_stories),
    }
