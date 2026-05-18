# syntax=docker/dockerfile:1.7
# Multi-stage with deliberate layer ordering for fast iteration:
#   - system deps     (rare change)
#   - python deps     (changes when pyproject.toml does)
#   - spaCy + models  (rare change)
#   - app code        (changes constantly)
# Code-only changes only re-run the final COPY, not pip install.

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ make curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python deps in their own layer. Docker layer caching is enough — this
# layer only re-runs when pyproject.toml changes.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# spaCy model in its own layer.
RUN python -m spacy download en_core_web_sm

# Pre-warm sentence-transformers + NLTK to avoid cold-start downloads in prod.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"
RUN python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('punkt_tab', quiet=True)"

# App code last — most frequent change.
COPY . .

EXPOSE 8000
# Shell form so ${PORT} (from Railway/Heroku-style platforms) gets expanded.
# Falls back to 8000 for local dev. The in-process scheduler in
# app/services/scheduler.py runs the ingest/enrich/cluster/build pipeline
# inside this same process — no separate worker needed.
# Disable by setting RUN_SCHEDULER=false in env.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips=*
