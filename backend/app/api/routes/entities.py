"""Entities endpoints: list, detail with related + recent stories."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Article, ArticleEntity, Entity, Story
from app.schemas.common import Page
from app.schemas.entity import EntityDetail, EntityListItem, RelatedEntity

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("", response_model=Page[EntityListItem])
async def list_entities(
    db: AsyncSession = Depends(get_db),
    type: str | None = Query(None),
    since_hours: int = Query(168, ge=1, le=720),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[EntityListItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    mention_q = (
        select(
            Entity.id, Entity.slug, Entity.name, Entity.type,
            func.coalesce(func.sum(ArticleEntity.mention_count), 0).label("mentions"),
        )
        .outerjoin(ArticleEntity, ArticleEntity.entity_id == Entity.id)
        .outerjoin(Article, (Article.id == ArticleEntity.article_id) & (Article.fetched_at >= cutoff))
    )
    if type:
        mention_q = mention_q.where(Entity.type == type.upper())

    grouped = mention_q.group_by(Entity.id, Entity.slug, Entity.name, Entity.type)
    ordered = grouped.order_by(func.coalesce(func.sum(ArticleEntity.mention_count), 0).desc())

    total = (await db.execute(
        select(func.count()).select_from(grouped.subquery())
    )).scalar_one()

    rows = (await db.execute(ordered.offset((page - 1) * page_size).limit(page_size))).all()
    items = [
        EntityListItem(slug=slug, name=name, type=type_, mention_count_7d=int(mentions))
        for (_id, slug, name, type_, mentions) in rows
    ]
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/{slug}", response_model=EntityDetail)
async def get_entity(slug: str, db: AsyncSession = Depends(get_db)) -> EntityDetail:
    result = (await db.execute(select(Entity).where(Entity.slug == slug))).scalar_one_or_none()
    if result is None:
        raise HTTPException(status_code=404, detail="Entity not found")

    # 7-day mention count
    cutoff_7d = datetime.now(timezone.utc) - timedelta(days=7)
    mentions = (await db.execute(
        select(func.coalesce(func.sum(ArticleEntity.mention_count), 0))
        .join(Article, Article.id == ArticleEntity.article_id)
        .where(ArticleEntity.entity_id == result.id, Article.fetched_at >= cutoff_7d)
    )).scalar_one()

    # Recent stories featuring this entity
    story_rows = (await db.execute(
        select(
            Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at,
        )
        .join(Article, Article.story_id == Story.id)
        .join(ArticleEntity, ArticleEntity.article_id == Article.id)
        .where(ArticleEntity.entity_id == result.id)
        .group_by(Story.id, Story.slug, Story.name, Story.source_count, Story.last_updated_at)
        .order_by(Story.last_updated_at.desc())
        .limit(20)
    )).all()
    recent_stories = [
        {
            "id": sid, "slug": slug_, "name": name,
            "source_count": sc, "last_updated_at": ts.isoformat(),
        }
        for (sid, slug_, name, sc, ts) in story_rows
    ]

    # Related entities (co-mentioned in same articles).
    # Start FROM `b_alias` (anchored to this entity) then join `a_alias` on shared article_id.
    a_alias = ArticleEntity.__table__.alias("a")
    b_alias = ArticleEntity.__table__.alias("b")
    related_rows = (await db.execute(
        select(Entity.slug, Entity.name, Entity.type, func.count(a_alias.c.article_id))
        .select_from(b_alias)
        .join(a_alias, a_alias.c.article_id == b_alias.c.article_id)
        .join(Entity, Entity.id == a_alias.c.entity_id)
        .where(
            b_alias.c.entity_id == result.id,
            a_alias.c.entity_id != result.id,
        )
        .group_by(Entity.slug, Entity.name, Entity.type)
        .order_by(func.count(a_alias.c.article_id).desc())
        .limit(10)
    )).all()
    related = [
        RelatedEntity(slug=s, name=n, type=t, cooccurrence=int(c))
        for (s, n, t, c) in related_rows
    ]

    return EntityDetail(
        slug=result.slug, name=result.name, type=result.type,
        mention_count_7d=int(mentions or 0),
        canonical_name=result.canonical_name,
        wiki_url=result.wiki_url,
        recent_stories=recent_stories,
        related=related,
    )
