"""KeyBERT-based topic extraction.

We reuse the same MiniLM model that powers article embeddings — KeyBERT
just needs an encoder, and reusing avoids loading a second model.
"""

from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Keyphrase:
    name: str
    score: float


_STOPWORDS = "english"


@lru_cache(maxsize=1)
def _keybert():
    from keybert import KeyBERT
    from app.ml.embeddings import _model
    return KeyBERT(model=_model())


def extract_topics(
    text: str,
    *,
    top_n: int = 5,
    ngram_range: tuple[int, int] = (1, 2),
) -> list[Keyphrase]:
    """Return the top-N keyphrases (uni+bi-grams by default)."""
    text = (text or "").strip()
    if not text:
        return []
    raw = _keybert().extract_keywords(
        text[:20_000],
        keyphrase_ngram_range=ngram_range,
        stop_words=_STOPWORDS,
        top_n=top_n,
        use_mmr=True,  # MMR diversifies — avoids returning 5 near-duplicates
        diversity=0.6,
    )
    return [Keyphrase(name=k.strip().lower(), score=float(s)) for k, s in raw if k.strip()]
