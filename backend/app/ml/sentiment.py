"""VADER-based sentiment scoring.

Returns the compound score in [-1, 1]: <0 negative, 0 neutral, >0 positive.
VADER is rule-based — fast, no model load — best for headline-length text.
For full article quality we'd swap in a transformer model later.
"""

from functools import lru_cache


@lru_cache(maxsize=1)
def _analyzer():
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    return SentimentIntensityAnalyzer()


def score_sentiment(text: str) -> float:
    text = (text or "").strip()
    if not text:
        return 0.0
    return float(_analyzer().polarity_scores(text)["compound"])
