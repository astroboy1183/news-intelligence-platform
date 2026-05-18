# News Intelligence Platform — Plan & As-Built

## Goal
Aggregate news from 120+ India + global sources, cluster articles into
**stories** (one event = one card with N source headlines), surface
trends/entities/topics with state-wise filtering, and layer on real
intelligence: threads, predictions, anomalies, network graph, browser
extension.

**No external LLM API for v1 — all NLP/ML is local.**

---

## Locked decisions

- **Angle:** cross-source story clustering as the core UX
- **Sources:** 70 India + 50 global English-language RSS (87 active after dead-feed pruning)
- **Ingestion cadence:** every 2 minutes, with `If-Modified-Since` / `ETag`
- **Filters:** country + Indian state, first-class
- **Language:** English only for v1
- **Retention:** all articles forever (HNSW + BTREE + GIN indexes)
- **Deploy target:** localhost first, then Fly.io / Railway + Vercel + R2
- **No LLM API** — local ML/NLP. Claude Haiku can be added later for cluster naming / TL;DR quality.

---

## Tech stack (as built)

| Layer | Choice | Status |
|---|---|---|
| Orchestration | Prefect 3 (`flows/serve.py` with cron schedules) | ✓ |
| OLTP + vectors | Postgres 16 + pgvector (HNSW, cosine) | ✓ |
| Object storage | MinIO (local), R2 (deploy) | ✓ scaffolded |
| Cache | Redis 7 | ✓ |
| Embeddings | sentence-transformers `all-MiniLM-L6-v2` | ✓ |
| NER | spaCy `en_core_web_sm` | ✓ |
| Keywords | KeyBERT (MMR) | ✓ |
| Summaries | Sumy LexRank | ✓ |
| Sentiment | vaderSentiment | ✓ |
| Predictive | hand-tuned heuristic (lightgbm v2 once data) | ✓ v1 |
| Network | networkx + pre-computed `entity_cooccurrence` table | ✓ |
| API | FastAPI + SQLAlchemy 2.0 async + Alembic | ✓ |
| Frontend | Next.js 15 + TypeScript + Tailwind | ✓ |
| Charts | Recharts | ✓ |
| Extension | WebExtension API (Manifest V3, Chrome+Firefox) | ✓ |

---

## API surface (22 endpoints)

Core:
- `GET /` — root
- `GET /health` — db-aware
- `GET /stories`, `GET /stories/{id}` — list with country/state filters, detail
- `GET /entities`, `GET /entities/{slug}` — list + profile w/ related entities
- `GET /topics`, `GET /topics/{slug}` — list + profile w/ related topics
- `GET /sources`, `GET /sources/health` — list + ingestion health
- `GET /threads`, `GET /threads/{slug}` — multi-day narrative threads
- `GET /trends/topics`, `GET /trends/by-state` — time series + map data

Intelligence:
- `GET /insights/summary` — anomalies, first-to-break, quiet, gaps
- `GET /predictions/rising`, `GET /predictions/accuracy` — predictive risers
- `GET /network` — entity co-occurrence graph
- `GET /sources/intelligence/breaking`, `/overlap` — breaking power + Jaccard
- `GET /brief/today` — daily brief
- `GET /lookup?url=...` — browser-extension endpoint

---

## Frontend pages (12)

- `/` Dashboard — story cards + trending topics + entities + ingestion health
- `/brief` Daily brief
- `/threads`, `/threads/[slug]` — narrative threads
- `/insights` — anomalies / first-to-break / quiet stories / coverage gaps
- `/trends` — topic time-series chart (Recharts)
- `/map` — India state story-density bar chart
- `/predictions` — predicted blow-ups with confidence + accuracy stats
- `/network` — entity co-mention neighborhoods
- `/sources` — full source table with health status
- `/sources/intelligence` — breaking power + source overlap matrix
- `/stories/[id]` — story detail (timeline, entities, topics, coverage)
- `/entities/[slug]`, `/topics/[slug]` — profiles

---

## Browser extension

Manifest V3, works in Chrome + Firefox.
- Popup queries `GET /lookup?url=<tab.url>` to find the story for the current page
- Shows: story name, source_count, first-reported-by, TL;DR bullets, list of other outlets covering same story, lean spread bars, CTA to open full story on the web app
- Settings popover for switching API base URL

Load via `chrome://extensions` → "Load unpacked" → pick `extension/`.

---

## Build sequence (as executed)

### Phase A — Core platform ✓
1. Scaffold + docker-compose
2. Schema + first migration + pgvector + HNSW
3. Seed 120 sources + 36 states
4. RSS ingestion (httpx, feedparser, dedup, per-host rate limit, conditional GET)
5. Enrichment (sentence-transformers + spaCy + KeyBERT + VADER)
6. Clustering (pgvector kNN, similarity threshold 0.78)
7. Story builder (TF-IDF cluster naming, LexRank TL;DR, state tagging, velocity)
8. Core API: stories, entities, topics, sources, health
9. Next.js scaffold + dashboard + detail pages

### Phase B — Intelligence ✓
10. Thread detection (entity+topic Jaccard, temporal window)
11. Anomaly detection (entity surges/silences, novel entities, story bursts, coverage gaps)
12. Predictive blow-up scoring (heuristic v1)
13. Entity co-occurrence refresh
14. Phase B API + frontend pages

### Phase C — Extension ✓
15. Browser extension (popup + lookup integration)

### Polish ✓
16. Prefect `serve.py` with cron schedules:
    - ingest: every 2 min
    - enrich: every 5 min
    - cluster: every 5 min
    - build-stories: every 10 min
    - intelligence (threads + anomalies + predictions + cooccurrence): every 30 min

### Deferred for later
- Podcast ingestion + Whisper.cpp transcription
- Piper TTS audio brief
- Knowledge graph (proper SPO extraction)
- Bias/framing lens beyond source-lean buckets (would benefit from LLM)
- User accounts / personal watchlists

---

## Local commands

```
make up                  # bring up Postgres+pgvector, Redis, MinIO, Prefect
make migrate             # alembic upgrade head
make seed                # idempotent seed (sources + states)
make ingest              # one-off RSS pass across all active sources
make enrich              # one-off enrichment of unembedded articles
make cluster             # one-off pgvector kNN clustering
make build-stories       # one-off naming + TL;DR + state tagging
make intelligence        # one-off threads + anomalies + predictions + cooccurrence
make pipeline            # ingest → enrich → cluster → build-stories → intelligence (sequential)
make serve               # Prefect long-lived process running all flows on cron
make backend-dev         # FastAPI with reload on :8000
make frontend-dev        # Next.js dev on :3000
```
