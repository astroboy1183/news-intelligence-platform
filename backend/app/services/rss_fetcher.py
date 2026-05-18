"""Async RSS fetcher with conditional GET, transparent curl_cffi fallback for
bot-blocked sites, and an HTML-link scrape mode for sources without usable RSS."""

import asyncio
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin, urlparse

import feedparser
import httpx
from dateutil import parser as date_parser
from loguru import logger

from app.core.config import settings

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

# Status codes that suggest the server is blocking us — retry with curl_cffi (TLS spoofing).
_BLOCKED_STATUSES = {401, 403, 429, 503}


@dataclass
class ParsedEntry:
    url: str
    title: str
    lead: str | None = None
    author: str | None = None
    published_at: datetime | None = None


@dataclass
class FetchResult:
    not_modified: bool
    etag: str | None = None
    last_modified: str | None = None
    entries: list[ParsedEntry] = field(default_factory=list)
    status_code: int = 0


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = date_parser.parse(value)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _entry_to_parsed(entry: dict[str, Any]) -> ParsedEntry | None:
    link = entry.get("link")
    title = entry.get("title")
    if not link or not title:
        return None
    summary = entry.get("summary") or entry.get("description")
    author = entry.get("author")
    published = entry.get("published") or entry.get("updated")
    return ParsedEntry(
        url=link,
        title=str(title).strip(),
        lead=str(summary) if summary else None,
        author=str(author) if author else None,
        published_at=_parse_date(published if isinstance(published, str) else None),
    )


def _fetch_with_curl_cffi(url: str, *, etag: str | None, last_modified: str | None) -> tuple[int, bytes, dict]:
    """Synchronous curl_cffi GET with Chrome TLS fingerprint. Blocking; run in a thread.

    Used as fallback when httpx returns 401/403/429/503 — those usually mean the
    server is fingerprinting TLS/HTTP2 and refusing non-browser clients.
    """
    from curl_cffi import requests as cr

    headers = {"User-Agent": USER_AGENT}
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified
    response = cr.get(
        url,
        headers=headers,
        impersonate="chrome120",
        timeout=settings.fetch_timeout_seconds,
        allow_redirects=True,
    )
    return response.status_code, bytes(response.content), dict(response.headers)


_ARTICLE_LINK_RE = re.compile(
    r"/(?:news|article|story|articles|stories|world|india|business|sports|tech|opinion|politics|"
    r"national|cricket|entertainment|economy|markets|videos|reportage|expert-speak|2025|2026)/[a-z0-9][\w\-/]{20,}",
    re.IGNORECASE,
)
_NON_ARTICLE_RE = re.compile(
    r"(?:\?|#|\.(?:jpg|png|gif|pdf|mp3|mp4|svg)$|/tag/|/topic/|/category/|/author/|/photos?/)",
    re.IGNORECASE,
)
_WAYBACK_PREFIX_RE = re.compile(
    r"^https?://web\.archive\.org/web/\d+(?:[a-z_]+)?/", re.IGNORECASE,
)


def _strip_wayback(url: str) -> str:
    """Unwrap a Wayback Machine archive URL back to the original article URL."""
    return _WAYBACK_PREFIX_RE.sub("", url)


def _scrape_article_links(html: bytes, base_url: str, limit: int = 60) -> list[ParsedEntry]:
    """Extract probable article links from a section page HTML body."""
    text = html.decode("utf-8", errors="ignore")
    seen: set[str] = set()
    entries: list[ParsedEntry] = []
    parsed_base = urlparse(base_url)
    home_host = parsed_base.netloc

    # Find <a href="..." ...>title</a>. Greedy enough; we'll filter heavily after.
    for match in re.finditer(r'<a[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', text, re.IGNORECASE | re.DOTALL):
        href, inner = match.group(1).strip(), match.group(2)
        if not href or href.startswith(("mailto:", "javascript:", "tel:", "#")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != home_host:
            continue
        if _NON_ARTICLE_RE.search(parsed.path):
            continue
        if not _ARTICLE_LINK_RE.search(parsed.path):
            continue
        # Wayback-wrap unwrap so dedup hashes the real article URL.
        canonical = _strip_wayback(absolute)
        if canonical in seen:
            continue
        # Strip tags + collapse whitespace from inner text → title
        title = re.sub(r"<[^>]+>", " ", inner)
        title = re.sub(r"\s+", " ", title).strip()
        if len(title) < 15 or len(title) > 300:
            continue
        seen.add(canonical)
        entries.append(ParsedEntry(url=canonical, title=title))
        if len(entries) >= limit:
            break
    return entries


async def fetch_feed(
    client: httpx.AsyncClient,
    rss_url: str,
    *,
    etag: str | None = None,
    last_modified: str | None = None,
    allow_html_scrape: bool = True,
) -> FetchResult:
    """Fetch + parse one RSS feed (or HTML section page).

    Falls back to curl_cffi TLS spoofing on 401/403/429/503.
    Falls back to HTML link scraping when parsed body has no entries (or content is HTML).
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*",
    }
    if etag:
        headers["If-None-Match"] = etag
    if last_modified:
        headers["If-Modified-Since"] = last_modified

    try:
        response = await client.get(
            rss_url,
            headers=headers,
            timeout=settings.fetch_timeout_seconds,
            follow_redirects=True,
        )
        status_code = response.status_code
        content = response.content
        resp_headers = dict(response.headers)
    except httpx.HTTPError as exc:
        logger.debug(f"httpx error for {rss_url}: {exc!r}; falling back to curl_cffi")
        status_code, content, resp_headers = await asyncio.to_thread(
            _fetch_with_curl_cffi, rss_url, etag=etag, last_modified=last_modified
        )

    # Bot block? Retry with curl_cffi.
    if status_code in _BLOCKED_STATUSES:
        logger.debug(f"status {status_code} from {rss_url}; retrying with curl_cffi")
        status_code, content, resp_headers = await asyncio.to_thread(
            _fetch_with_curl_cffi, rss_url, etag=etag, last_modified=last_modified
        )

    if status_code == 304:
        return FetchResult(
            not_modified=True, etag=etag, last_modified=last_modified, status_code=304
        )

    if status_code >= 400:
        raise httpx.HTTPStatusError(
            f"Final status {status_code}", request=None, response=None  # type: ignore[arg-type]
        )

    new_etag = resp_headers.get("ETag") or resp_headers.get("etag")
    new_modified = resp_headers.get("Last-Modified") or resp_headers.get("last-modified")
    content_type = (resp_headers.get("Content-Type") or resp_headers.get("content-type") or "").lower()

    # Try RSS/Atom parsing first.
    feed = feedparser.parse(content)
    entries: list[ParsedEntry] = []
    for raw_entry in feed.entries:
        parsed = _entry_to_parsed(dict(raw_entry))
        if parsed is not None:
            entries.append(parsed)

    # Fallback: if no entries AND the body looks like HTML, scrape article links.
    if not entries and allow_html_scrape and ("html" in content_type or content[:200].lower().lstrip().startswith(b"<!doctype html") or b"<html" in content[:400].lower()):
        scraped = _scrape_article_links(content, rss_url)
        if scraped:
            logger.info(f"html-scrape fallback succeeded for {rss_url}: {len(scraped)} links")
            entries = scraped
        else:
            logger.warning(f"html-scrape fallback found 0 article links for {rss_url}")

    if not entries:
        bozo_exc = getattr(feed, "bozo_exception", None)
        if bozo_exc:
            logger.warning(f"bozo feed {rss_url}: {bozo_exc}")

    return FetchResult(
        not_modified=False,
        etag=new_etag,
        last_modified=new_modified,
        entries=entries,
        status_code=status_code,
    )
