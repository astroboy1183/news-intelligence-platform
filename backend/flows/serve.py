"""Run all NewsIntel flows on a schedule (long-lived process).

    python -m flows.serve

Cron schedules below. Pipeline graph:
    ingest (every 2 min)
        → enrich   (every 5 min, fills articles with embeddings/entities/topics)
        → cluster  (every 5 min, kNN assignment to stories)
        → build_stories (every 10 min, names/TL;DRs/state tags)
        → intelligence  (every 30 min, threads + anomalies + predictions + cooccurrence)

Each step idempotently picks up only what's new, so independent schedules are
fine — no orchestration glue needed.
"""

from prefect import serve

from flows.build_stories import build_stories_flow
from flows.cluster import cluster_articles_flow
from flows.enrich import enrich_articles_flow
from flows.ingest import ingest_all_sources_flow
from flows.intelligence import intelligence_all_flow


if __name__ == "__main__":
    serve(
        ingest_all_sources_flow.to_deployment(name="ingest", cron="*/2 * * * *"),
        enrich_articles_flow.to_deployment(name="enrich", cron="*/5 * * * *"),
        cluster_articles_flow.to_deployment(name="cluster", cron="*/5 * * * *"),
        build_stories_flow.to_deployment(name="build-stories", cron="*/10 * * * *"),
        intelligence_all_flow.to_deployment(name="intelligence", cron="*/30 * * * *"),
    )
