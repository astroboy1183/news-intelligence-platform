"""Stories endpoints: list (with filters) + detail."""

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, ArticleEntity, ArticleTopic, Entity, Source, Story, Topic
from app.schemas.common import Page
from app.schemas.story import (
    CoverageBreakdownItem,
    StoryArticleSummary,
    StoryDetail,
    StoryEntityRef,
    StoryListItem,
    StoryTopicRef,
)

router = APIRouter(prefix="/stories", tags=["stories"])


SortBy = Literal["trending", "recent", "most_covered"]


@router.get("", response_model=Page[StoryListItem])
async def list_stories(
    db: AsyncSession = Depends(get_db),
    country: str | None = Query(None, min_length=2, max_length=2),
    region: str | None = Query(None, description="india | global — shortcut over country"),
    state: str | None = Query(None),
    since_hours: int = Query(24, ge=1, le=720),
    min_sources: int = Query(2, ge=1),
    sort: SortBy = Query("trending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Page[StoryListItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    base = select(Story).where(
        Story.last_updated_at >= cutoff,
        Story.source_count >= min_sources,
    )
    if region == "india":
        base = base.where(Story.primary_country == "IN")
    elif region == "global":
        base = base.where(Story.primary_country != "IN", Story.primary_country.is_not(None))
    if country:
        base = base.where(Story.primary_country == country.upper())
    if state:
        base = base.where(Story.primary_state == state)

    if sort == "trending":
        # Time-decayed coverage. A story at hour t scores:
        #   source_count * exp(-t / 4h)
        # so a 5-outlet story 1h old (≈4.4) beats a 10-outlet story 12h old (≈0.5).
        # The dashboard's "trending" surfaces fresh momentum, not stale popularity.
        age_seconds = func.extract("epoch", func.now() - Story.last_updated_at)
        decayed_score = Story.source_count * func.exp(-age_seconds / 14400.0)
        ordered = base.order_by(
            decayed_score.desc(),
            Story.last_updated_at.desc(),
        )
    elif sort == "recent":
        ordered = base.order_by(Story.last_updated_at.desc())
    else:  # most_covered
        ordered = base.order_by(Story.source_count.desc(), Story.last_updated_at.desc())

    # Total
    total_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_stmt)).scalar_one()

    rows = (
        await db.execute(ordered.offset((page - 1) * page_size).limit(page_size))
    ).scalars().all()

    items = [
        StoryListItem(
            id=s.id, slug=s.slug, name=s.name, tldr=list(s.tldr or []),
            first_seen_at=s.first_seen_at, last_updated_at=s.last_updated_at,
            article_count=s.article_count, source_count=s.source_count,
            velocity_score=s.velocity_score,
            primary_state=s.primary_state, primary_country=s.primary_country,
            category=s.category,
        )
        for s in rows
    ]
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/{story_id}", response_model=StoryDetail)
async def get_story(story_id: int, db: AsyncSession = Depends(get_db)) -> StoryDetail:
    story = await db.get(Story, story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")

    # Articles in this cluster + their source info, newest first
    art_rows = (await db.execute(
        select(Article, Source.slug, Source.name, Source.country)
        .join(Source, Source.id == Article.source_id)
        .where(Article.story_id == story_id)
        .order_by(Article.published_at.desc().nullslast(), Article.fetched_at.desc())
        .limit(100)
    )).all()
    articles = [
        StoryArticleSummary(
            id=a.id, title=a.title, url=a.url,
            source_slug=slug, source_name=name,
            published_at=a.published_at, fetched_at=a.fetched_at,
        )
        for (a, slug, name, _country) in art_rows
    ]

    # Top entities
    ent_rows = (await db.execute(
        select(Entity.slug, Entity.name, Entity.type, func.sum(ArticleEntity.mention_count))
        .join(ArticleEntity, ArticleEntity.entity_id == Entity.id)
        .join(Article, Article.id == ArticleEntity.article_id)
        .where(Article.story_id == story_id)
        .group_by(Entity.slug, Entity.name, Entity.type)
        .order_by(func.sum(ArticleEntity.mention_count).desc())
        .limit(15)
    )).all()
    entities = [
        StoryEntityRef(slug=slug, name=name, type=type_, mention_count=int(c or 0))
        for (slug, name, type_, c) in ent_rows
    ]

    # Top topics
    top_rows = (await db.execute(
        select(Topic.slug, Topic.name, func.avg(ArticleTopic.score))
        .join(ArticleTopic, ArticleTopic.topic_id == Topic.id)
        .join(Article, Article.id == ArticleTopic.article_id)
        .where(Article.story_id == story_id)
        .group_by(Topic.slug, Topic.name)
        .order_by(func.avg(ArticleTopic.score).desc())
        .limit(10)
    )).all()
    topics = [
        StoryTopicRef(slug=slug, name=name, score=float(score or 0))
        for (slug, name, score) in top_rows
    ]

    # Coverage breakdown by country (outlet count per country in this story)
    cov_counter: Counter[str] = Counter()
    seen_sources: set[int] = set()
    src_rows = (await db.execute(
        select(Source.id, Source.country).join(Article, Article.source_id == Source.id)
        .where(Article.story_id == story_id)
    )).all()
    for source_id, country in src_rows:
        if source_id not in seen_sources and country:
            seen_sources.add(source_id)
            cov_counter[country] += 1
    coverage = [
        CoverageBreakdownItem(country=c, outlet_count=n)
        for c, n in cov_counter.most_common()
    ]

    # First-reported source slug
    first_slug = None
    if story.first_reported_by_source_id:
        src = await db.get(Source, story.first_reported_by_source_id)
        first_slug = src.slug if src else None

    return StoryDetail(
        id=story.id, slug=story.slug, name=story.name, tldr=list(story.tldr or []),
        first_seen_at=story.first_seen_at, last_updated_at=story.last_updated_at,
        article_count=story.article_count, source_count=story.source_count,
        velocity_score=story.velocity_score,
        primary_state=story.primary_state, primary_country=story.primary_country,
        category=story.category,
        articles=articles, entities=entities, topics=topics,
        coverage_by_country=coverage, first_reported_by_source_slug=first_slug,
    )
