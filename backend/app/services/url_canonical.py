"""URL canonicalization + content hashing used by the dedup pipeline."""

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Tracking/analytics params we strip so the same article from a tagged link
# hashes to the same value as the bare link.
TRACKING_PARAMS: frozenset[str] = frozenset({
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "utm_id", "utm_name", "utm_reader",
    "fbclid", "gclid", "yclid", "msclkid",
    "ref", "ref_src", "ref_url",
    "mc_cid", "mc_eid",
    "_ga", "_gl",
    "feature", "pinned_post_locator", "pinned_post_asset_id", "pinned_post_type",
    "guccounter", "guce_referrer", "guce_referrer_sig",
})

_WHITESPACE_RE = re.compile(r"\s+")


def canonicalize_url(url: str) -> str:
    """Lowercase scheme+host, drop tracking params, strip fragment, sort query."""
    parsed = urlparse(url.strip())
    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc.lower()
    # Strip default ports
    if scheme == "http" and netloc.endswith(":80"):
        netloc = netloc[:-3]
    elif scheme == "https" and netloc.endswith(":443"):
        netloc = netloc[:-4]
    # Strip tracking params + sort for determinism
    kept = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=False)
        if k.lower() not in TRACKING_PARAMS
    ]
    kept.sort()
    query = urlencode(kept)
    # Strip trailing slash except root
    path = parsed.path
    if len(path) > 1 and path.endswith("/"):
        path = path.rstrip("/")
    return urlunparse((scheme, netloc, path, "", query, ""))


def url_hash(url: str) -> str:
    """SHA-256 (hex, 64 chars) of canonicalized URL — used as dedup key."""
    return hashlib.sha256(canonicalize_url(url).encode("utf-8")).hexdigest()


def title_hash(title: str) -> str:
    """SHA-256 of normalized title for near-dup detection."""
    norm = _WHITESPACE_RE.sub(" ", title.lower().strip())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()
