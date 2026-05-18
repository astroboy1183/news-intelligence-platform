"""Story-level enrichment: name, TL;DR, state tagging, velocity.

Runs after clustering. For each story that was touched recently, we recompute:
  - name (TF-IDF top-3 noun-ish terms across its article titles, or fall back to centroid article's title)
  - tldr (Sumy LexRank extractive summary over concatenated leads)
  - primary_state (entity-match against indian_state.aliases; falls back to source.region)
  - primary_country (most common country across articles in the cluster)
  - velocity_score (articles in last 6h, normalized)
"""

import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import bindparam, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article, IndianState, Source, Story

WINDOW_HOURS = 6


# ---------- naming ----------

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "as", "is", "are", "was", "were", "be", "been", "being", "by", "at", "from",
    "this", "that", "these", "those", "it", "its", "they", "them", "their",
    "he", "she", "his", "her", "him", "we", "us", "our", "you", "your",
    "says", "said", "new", "says.", "year", "after", "before",
    "live", "update", "updates", "news", "latest",
}

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]+")


def _name_from_titles(titles: list[str]) -> str:
    """Cheap TF-IDF-ish heuristic: capitalized bigrams across titles win."""
    if not titles:
        return "(untitled)"
    # Count capitalized words and bigrams.
    word_counter: Counter[str] = Counter()
    bigram_counter: Counter[str] = Counter()
    for t in titles:
        tokens = _WORD_RE.findall(t)
        cleaned = [w for w in tokens if w.lower() not in _STOPWORDS]
        for w in cleaned:
            if w[0].isupper():
                word_counter[w] += 1
        for a, b in zip(cleaned, cleaned[1:]):
            if a[0].isupper() and b[0].isupper():
                bigram_counter[f"{a} {b}"] += 1

    # Pick the longest representative title that contains the top bigram.
    if bigram_counter:
        top_bigram = bigram_counter.most_common(1)[0][0]
        for t in sorted(titles, key=len):
            if top_bigram in t:
                return t[:500]
    # Fall back to most representative title (median length).
    return sorted(titles, key=len)[len(titles) // 2][:500]


# ---------- TL;DR ----------


def _build_tldr(leads: list[str], k: int = 3) -> list[str]:
    """LexRank over concatenated leads. Returns up to k bullet sentences."""
    text_blob = " ".join(L.strip() for L in leads if L)
    text_blob = re.sub(r"<[^>]+>", " ", text_blob)
    text_blob = re.sub(r"\s+", " ", text_blob).strip()
    if not text_blob:
        return []
    try:
        from sumy.parsers.plaintext import PlaintextParser
        from sumy.nlp.tokenizers import Tokenizer
        from sumy.summarizers.lex_rank import LexRankSummarizer
        parser = PlaintextParser.from_string(text_blob, Tokenizer("english"))
        summarizer = LexRankSummarizer()
        sentences = [str(s).strip() for s in summarizer(parser.document, k)]
        return [s for s in sentences if s]
    except Exception as exc:
        logger.warning(f"tldr failed: {exc}")
        return []


# ---------- state tagging ----------


@dataclass(frozen=True)
class _StateMatcher:
    name_by_alias: dict[str, str]

    def detect(self, text_blob: str) -> str | None:
        if not text_blob:
            return None
        lower = text_blob.lower()
        counts: Counter[str] = Counter()
        for alias, state_name in self.name_by_alias.items():
            # All aliases are lowercase and ≥4 chars (we filtered at load time).
            # Use word-boundary match so "kerala" doesn't fire on "keralan".
            if re.search(rf"\b{re.escape(alias)}\b", lower):
                counts[state_name] += 1
        if not counts:
            return None
        return counts.most_common(1)[0][0]


async def _load_state_matcher(session: AsyncSession) -> _StateMatcher:
    """Load aliases only — short codes ("OR", "AP", "TS") false-positive in news text."""
    res = await session.execute(select(IndianState))
    mapping: dict[str, str] = {}
    for st in res.scalars():
        mapping[st.name.lower()] = st.name
        for alias in (st.aliases or []):
            if len(alias) >= 4:  # skip short codes; rely on full state name + city aliases
                mapping[alias.lower()] = st.name
    return _StateMatcher(name_by_alias=mapping)


# ---------- main builder ----------


async def _stories_to_build(session: AsyncSession, recently_touched_hours: int = 24) -> list[int]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=recently_touched_hours)
    stmt = (
        select(Story.id)
        .where(Story.last_updated_at >= cutoff)
        .order_by(Story.last_updated_at.desc())
    )
    res = await session.execute(stmt)
    return [r[0] for r in res.all()]


async def build_stories(session: AsyncSession, story_ids: list[int] | None = None) -> dict:
    """Update name/tldr/primary_state/primary_country/velocity for the given (or recent) stories."""
    if story_ids is None:
        story_ids = await _stories_to_build(session)
    if not story_ids:
        return {"built": 0}

    matcher = await _load_state_matcher(session)

    built = 0
    for sid in story_ids:
        # Pull articles + their source country, in published-time order.
        stmt = (
            select(Article, Source.country, Source.region)
            .join(Source, Source.id == Article.source_id)
            .where(Article.story_id == sid)
            .order_by(Article.published_at.asc().nullslast(), Article.fetched_at.asc())
        )
        rows = list((await session.execute(stmt)).all())
        if not rows:
            continue

        titles = [a.title for (a, _, _) in rows]
        leads = [a.lead or "" for (a, _, _) in rows]
        countries = Counter(c for (_, c, _) in rows if c)
        primary_country = countries.most_common(1)[0][0] if countries else None

        name = _name_from_titles(titles)
        tldr = _build_tldr(leads)

        # State tagging: require an alias match in title+lead content.
        # Don't fall back to source.region — outlets cover stories outside their home state,
        # and majority-region tagging produced false positives (e.g. Ebola → Telangana).
        blob = " ".join(titles) + " " + " ".join(leads)
        primary_state = matcher.detect(blob) if primary_country == "IN" else None

        # Velocity: articles in last WINDOW_HOURS / total
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(hours=WINDOW_HOURS)
        recent = sum(
            1 for (a, _, _) in rows
            if (a.published_at or a.fetched_at) and (a.published_at or a.fetched_at) >= window_start
        )
        velocity = recent / max(len(rows), 1)

        await session.execute(
            update(Story)
            .where(Story.id == sid)
            .values(
                name=name,
                tldr=tldr,
                primary_state=primary_state,
                primary_country=primary_country,
                velocity_score=float(velocity),
            )
        )
        built += 1

    await session.commit()
    logger.info(f"built {built} stories")
    return {"built": built}
