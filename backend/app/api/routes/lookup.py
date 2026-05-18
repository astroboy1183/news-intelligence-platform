"""URL → story lookup, used by the browser extension."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, Source, Story
from app.services.url_canonical import url_hash

router = APIRouter(prefix="/lookup", tags=["lookup"])


@router.get("")
async def lookup_by_url(
    url: str = Query(..., min_length=8),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Find the story that this article URL belongs to."""
    h = url_hash(url)
    article = (await db.execute(
        select(Article).where(Article.url_hash == h)
    )).scalar_one_or_none()
    if article is None or article.story_id is None:
        raise HTTPException(status_code=404, detail="No matching story for this URL")

    story = await db.get(Story, article.story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story missing")

    # All sibling articles in the story
    rows = (await db.execute(
        select(Article.title, Article.url, Source.slug, Source.name, Source.country, Source.political_lean)
        .join(Source, Source.id == Article.source_id)
        .where(Article.story_id == story.id)
        .order_by(Article.published_at.desc().nullslast())
        .limit(30)
    )).all()

    coverage = [
        {
            "title": t, "url": u, "source_slug": ss, "source_name": sn,
            "country": cn, "political_lean": pl,
        }
        for (t, u, ss, sn, cn, pl) in rows
    ]

    first_slug = None
    if story.first_reported_by_source_id:
        src = await db.get(Source, story.first_reported_by_source_id)
        first_slug = src.slug if src else None

    return {
        "story": {
            "id": story.id, "slug": story.slug, "name": story.name,
            "source_count": story.source_count,
            "tldr": list(story.tldr or []),
            "thread_id": story.thread_id,
            "first_reported_by": first_slug,
        },
        "coverage": coverage,
    }
