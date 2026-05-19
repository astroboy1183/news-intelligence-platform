"""RSS 2.0 + JSON Feed exports of any filtered story list.

Lets users (and external integrations like Slack, IFTTT, n8n) subscribe to
slices of the dashboard — e.g. "trending stories in Karnataka with 5+ outlets"
— without needing a custom integration. Shares filter semantics with
GET /stories so a URL like the dashboard's search params can be pasted
straight in by swapping /stories for /feeds/stories.rss.
"""

from datetime import datetime, timedelta, timezone
from typing import Literal
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Story

router = APIRouter(prefix="/feeds", tags=["feeds"])

SortBy = Literal["trending", "recent", "most_covered"]
MAX_ITEMS = 50

SITE_URL = (settings.cors_origins.split(",")[0] or "").strip() or "https://example.com"


async def _fetch_stories(
    db: AsyncSession,
    *,
    country: str | None,
    region: str | None,
    state: str | None,
    since_hours: int,
    min_sources: int,
    sort: SortBy,
    limit: int,
) -> list[Story]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    stmt = select(Story).where(
        Story.last_updated_at >= cutoff,
        Story.source_count >= min_sources,
    )
    if region == "india":
        stmt = stmt.where(Story.primary_country == "IN")
    elif region == "global":
        stmt = stmt.where(Story.primary_country != "IN", Story.primary_country.is_not(None))
    if country:
        stmt = stmt.where(Story.primary_country == country.upper())
    if state:
        stmt = stmt.where(Story.primary_state == state)

    if sort == "most_covered":
        stmt = stmt.order_by(Story.source_count.desc(), Story.last_updated_at.desc())
    else:
        # trending and recent both want recency-first for feeds; the time-decayed
        # trending score is dashboard-specific and not meaningful in a subscribed feed.
        stmt = stmt.order_by(Story.last_updated_at.desc())

    stmt = stmt.limit(limit)
    return list((await db.execute(stmt)).scalars().all())


def _story_html_url(story_id: int) -> str:
    return f"{SITE_URL.rstrip('/')}/stories/{story_id}"


def _feed_title(*, region: str | None, state: str | None, sort: SortBy) -> str:
    parts: list[str] = []
    if region == "india":
        parts.append("India")
    elif region == "global":
        parts.append("Global")
    if state:
        parts.append(state)
    if not parts:
        parts.append("Worldwide")
    return f"NewsIntel · {' / '.join(parts)} · {sort}"


@router.get("/stories.rss")
async def stories_rss(
    request: Request,
    db: AsyncSession = Depends(get_db),
    country: str | None = Query(None, min_length=2, max_length=2),
    region: str | None = Query(None),
    state: str | None = Query(None),
    since_hours: int = Query(48, ge=1, le=720),
    min_sources: int = Query(2, ge=1),
    sort: SortBy = Query("recent"),
    limit: int = Query(25, ge=1, le=MAX_ITEMS),
) -> Response:
    stories = await _fetch_stories(
        db, country=country, region=region, state=state,
        since_hours=since_hours, min_sources=min_sources, sort=sort, limit=limit,
    )
    title = _feed_title(region=region, state=state, sort=sort)
    self_url = str(request.url)
    items_xml: list[str] = []
    for s in stories:
        desc_parts = list(s.tldr or [])
        desc = " · ".join(desc_parts) if desc_parts else s.name
        items_xml.append(
            f"<item>"
            f"<title>{xml_escape(s.name)}</title>"
            f"<link>{xml_escape(_story_html_url(s.id))}</link>"
            f"<guid isPermaLink=\"true\">{xml_escape(_story_html_url(s.id))}</guid>"
            f"<pubDate>{s.last_updated_at.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>"
            f"<description>{xml_escape(desc)}</description>"
            f"<category>{xml_escape(s.primary_country or 'world')}</category>"
            f"</item>"
        )

    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'
        f"<channel>"
        f"<title>{xml_escape(title)}</title>"
        f"<link>{xml_escape(SITE_URL)}</link>"
        f"<description>Clustered news stories from NewsIntel — {xml_escape(title)}.</description>"
        f'<atom:link href="{xml_escape(self_url)}" rel="self" type="application/rss+xml"/>'
        f"<lastBuildDate>{datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S +0000')}</lastBuildDate>"
        + "".join(items_xml)
        + "</channel></rss>"
    )
    return Response(
        content=body,
        media_type="application/rss+xml; charset=utf-8",
        headers={"cache-control": "public, max-age=60"},
    )


@router.get("/stories.json")
async def stories_json(
    request: Request,
    db: AsyncSession = Depends(get_db),
    country: str | None = Query(None, min_length=2, max_length=2),
    region: str | None = Query(None),
    state: str | None = Query(None),
    since_hours: int = Query(48, ge=1, le=720),
    min_sources: int = Query(2, ge=1),
    sort: SortBy = Query("recent"),
    limit: int = Query(25, ge=1, le=MAX_ITEMS),
) -> JSONResponse:
    """JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/)."""
    stories = await _fetch_stories(
        db, country=country, region=region, state=state,
        since_hours=since_hours, min_sources=min_sources, sort=sort, limit=limit,
    )
    title = _feed_title(region=region, state=state, sort=sort)
    items = [
        {
            "id": _story_html_url(s.id),
            "url": _story_html_url(s.id),
            "title": s.name,
            "content_text": " · ".join(list(s.tldr or [])) or s.name,
            "date_published": s.last_updated_at.isoformat(),
            "tags": [
                t for t in (s.primary_country, s.primary_state, s.category) if t
            ],
            "_newsintel": {
                "source_count": s.source_count,
                "article_count": s.article_count,
                "velocity_score": s.velocity_score,
            },
        }
        for s in stories
    ]
    payload = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": title,
        "home_page_url": SITE_URL,
        "feed_url": str(request.url),
        "items": items,
    }
    return JSONResponse(
        content=payload,
        headers={"cache-control": "public, max-age=60"},
    )
