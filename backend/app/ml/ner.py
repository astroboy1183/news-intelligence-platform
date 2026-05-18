"""spaCy-based named entity recognition.

We collapse spaCy's entity label set to four buckets we care about:
    PERSON / ORG / GPE / EVENT
Everything else is dropped (CARDINAL, DATE, ORDINAL, etc. are not useful here).
"""

import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from app.core.config import settings

# Map spaCy labels → our four buckets.
LABEL_MAP: dict[str, str] = {
    "PERSON": "PERSON",
    "ORG": "ORG",
    "GPE": "GPE",
    "LOC": "GPE",
    "NORP": "ORG",
    "FAC": "GPE",
    "EVENT": "EVENT",
    "LAW": "EVENT",
}

# Reject these surface forms even if spaCy tags them — too generic / too noisy.
ENTITY_STOPLIST = frozenset(
    s.lower() for s in [
        "the", "today", "yesterday", "tomorrow",
        "india", "indian",  # too generic for IN-heavy corpus; keep in topics, not entities
        "us", "u.s.", "uk", "u.k.",
        "ai", "the new york times", "the guardian", "bbc",
    ]
)


@dataclass(frozen=True)
class MentionedEntity:
    name: str
    type: str
    count: int


@lru_cache(maxsize=1)
def _nlp():
    import spacy
    return spacy.load(settings.spacy_model, disable=["lemmatizer", "tagger", "parser", "attribute_ruler"])


def _normalize(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip(" .,;:'\"-")
    return name


def extract_entities(text: str) -> list[MentionedEntity]:
    """Return deduped entities with per-document mention counts."""
    text = (text or "").strip()
    if not text:
        return []
    doc = _nlp()(text[:50_000])  # safety cap on input size
    counter: Counter[tuple[str, str]] = Counter()
    for ent in doc.ents:
        bucket = LABEL_MAP.get(ent.label_)
        if bucket is None:
            continue
        name = _normalize(ent.text)
        if not name or name.lower() in ENTITY_STOPLIST or len(name) < 2:
            continue
        counter[(name, bucket)] += 1
    return [MentionedEntity(name=n, type=t, count=c) for (n, t), c in counter.items()]
