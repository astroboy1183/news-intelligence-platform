"""Threads endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Story, Thread, ThreadStory
from app.schemas.common import Page
from app.schemas.intelligence import ThreadDetail, ThreadListItem, ThreadStoryRef

router = APIRouter(prefix="/threads", tags=["threads"])


@router.get("", response_model=Page[ThreadListItem])
async def list_threads(
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> Page[ThreadListItem]:
    q = select(Thread)
    if status:
        q = q.where(Thread.status == status)
    q = q.order_by(Thread.last_updated_at.desc())
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    items = [
        ThreadListItem(
            id=t.id, slug=t.slug, name=t.name,
            first_seen_at=t.first_seen_at, last_updated_at=t.last_updated_at,
            story_count=t.story_count, status=t.status,
        )
        for t in rows
    ]
    return Page(items=items, total=int(total), page=page, page_size=page_size)


@router.get("/{slug}", response_model=ThreadDetail)
async def get_thread(slug: str, db: AsyncSession = Depends(get_db)) -> ThreadDetail:
    thread = (await db.execute(select(Thread).where(Thread.slug == slug))).scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    stmt = (
        select(Story.id, Story.slug, Story.name, Story.source_count, Story.first_seen_at, ThreadStory.role)
        .join(ThreadStory, ThreadStory.story_id == Story.id)
        .where(ThreadStory.thread_id == thread.id)
        .order_by(Story.first_seen_at.asc())
    )
    stories = [
        ThreadStoryRef(
            id=sid, slug=slug_, name=name, source_count=sc,
            first_seen_at=ts, role=role,
        )
        for (sid, slug_, name, sc, ts, role) in (await db.execute(stmt)).all()
    ]
    return ThreadDetail(
        id=thread.id, slug=thread.slug, name=thread.name,
        first_seen_at=thread.first_seen_at, last_updated_at=thread.last_updated_at,
        story_count=thread.story_count, status=thread.status,
        stories=stories,
    )
