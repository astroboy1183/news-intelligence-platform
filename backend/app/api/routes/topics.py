"""Topics endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, ArticleTopic, Story, Topic
from app.schemas.common import Page
from app.schemas.topic import TopicDetail, TopicListItem

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("", response_model=Page[TopicListItem])
async def list_topics(
    db: AsyncSession = Depends(get_db),
    since_hours: int = Query(168, ge=1, le=720),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[TopicListItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    base = (
        select(Topic.slug, Topic.name, func.count(ArticleTopic.article_id).label("c"))
        .outerjoin(ArticleTopic, ArticleTopic.topic_id == Topic.id)
        .outerjoin(Article, (Article.id == ArticleTopic.article_id) & (Article.fetched_at >= cutoff))
        .group_by(Topic.slug, Topic.name)
        .order_by(func.count(ArticleTopic.article_id).desc())
    )

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(base.offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        TopicListItem(slug=s, name=n, article_count_7d=int(c or 0))
        for (s, n, c) in rows
    ]
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/{slug}", response_model=TopicDetail)
async def get_topic(slug: str, db: AsyncSession = Depends(get_db)) -> TopicDetail:
    topic = (await db.execute(select(Topic).where(Topic.slug == slug))).scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    cutoff_7d = datetime.now(timezone.utc) - timedelta(days=7)
    count = (await db.execute(
        select(func.count(ArticleTopic.article_id))
        .join(Article, Article.id == ArticleTopic.article_id)
        .where(ArticleTopic.topic_id == topic.id, Article.fetched_at >= cutoff_7d)
    )).scalar_one()

    story_rows = (await db.execute(
        select(Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at)
        .join(Article, Article.story_id == Story.id)
        .join(ArticleTopic, ArticleTopic.article_id == Article.id)
        .where(ArticleTopic.topic_id == topic.id)
        .group_by(Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at)
        .order_by(Story.last_updated_at.desc())
        .limit(20)
    )).all()
    recent = [
        {
            "id": sid, "slug": slug_, "name": name,
            "source_count": sc, "last_updated_at": ts.isoformat(),
        }
        for (sid, slug_, name, sc, ts) in story_rows
    ]

    # Related topics: other topics co-occurring on articles tagged with this topic.
    # Start FROM `b` (the anchor side filtered to our topic) then join `a` to its articles.
    a = ArticleTopic.__table__.alias("a")
    b = ArticleTopic.__table__.alias("b")
    rel_rows = (await db.execute(
        select(Topic.name, func.count(a.c.article_id))
        .select_from(b)
        .join(a, a.c.article_id == b.c.article_id)
        .join(Topic, Topic.id == a.c.topic_id)
        .where(b.c.topic_id == topic.id, a.c.topic_id != topic.id)
        .group_by(Topic.name)
        .order_by(func.count(a.c.article_id).desc())
        .limit(8)
    )).all()
    related = [n for (n, _) in rel_rows]

    return TopicDetail(
        slug=topic.slug, name=topic.name,
        article_count_7d=int(count or 0),
        recent_stories=recent,
        related_topics=related,
    )
