"""Small text-shaping helpers used across the enrichment pipeline."""

import re
import unicodedata


_WHITESPACE_RE = re.compile(r"\s+")


def slugify(value: str, *, max_len: int = 200) -> str:
    """A simple ASCII slug — kept stable so we can use it as a DB unique key."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value.lower())
    value = _WHITESPACE_RE.sub("-", value).strip("-")
    return value[:max_len] or "item"


def headline_plus_lead(title: str, lead: str | None) -> str:
    """Concatenate title + lead for embeddings/topics. Strip simple HTML."""
    title = (title or "").strip()
    lead = (lead or "").strip()
    if lead:
        lead = re.sub(r"<[^>]+>", " ", lead)
        lead = _WHITESPACE_RE.sub(" ", lead).strip()
    return (title + ". " + lead) if lead else title
