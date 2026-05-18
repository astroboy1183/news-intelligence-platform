"""Lazy-loaded sentence-transformer embedder.

Model file (~22MB) is downloaded on first use into ~/.cache/huggingface/
or our backend/models_cache via the env var SENTENCE_TRANSFORMERS_HOME.
"""

from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def _model():
    # Heavy import — keep lazy so unrelated tests don't pay it.
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.embedding_model)


def embed_one(text: str) -> list[float]:
    """Embed a single string → 384-dim list[float]."""
    text = (text or "").strip()
    if not text:
        # Return a zero vector (still typed correctly for pgvector).
        return [0.0] * 384
    vec = _model().encode(text, normalize_embeddings=True, show_progress_bar=False)
    return vec.tolist()


def embed_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Embed many strings → list of 384-dim list[float]."""
    if not texts:
        return []
    cleaned = [(t or "").strip() or " " for t in texts]
    vecs = _model().encode(
        cleaned,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vecs]
