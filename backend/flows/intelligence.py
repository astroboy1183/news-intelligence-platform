"""Prefect flows for Phase B intelligence: threads, anomalies, predictions, cooccurrence."""

import asyncio

from prefect import flow

from app.core.database import AsyncSessionLocal
from app.services.anomalies import detect_all
from app.services.cooccurrence import refresh_cooccurrence
from app.services.predictions import backfill_prediction_outcomes, score_predictions
from app.services.threads import detect_threads


@flow(name="detect_threads", log_prints=True)
async def detect_threads_flow() -> dict:
    async with AsyncSessionLocal() as session:
        return await detect_threads(session)


@flow(name="detect_anomalies", log_prints=True)
async def detect_anomalies_flow() -> dict:
    async with AsyncSessionLocal() as session:
        return await detect_all(session)


@flow(name="score_predictions", log_prints=True)
async def score_predictions_flow() -> dict:
    async with AsyncSessionLocal() as session:
        scored = await score_predictions(session)
        backfilled = await backfill_prediction_outcomes(session)
        return {**scored, "outcomes_backfilled": backfilled["updated"]}


@flow(name="refresh_cooccurrence", log_prints=True)
async def refresh_cooccurrence_flow() -> dict:
    async with AsyncSessionLocal() as session:
        return await refresh_cooccurrence(session)


@flow(name="intelligence_all", log_prints=True)
async def intelligence_all_flow() -> dict:
    """Run all Phase B intelligence jobs in sequence."""
    threads = await detect_threads_flow()
    anomalies = await detect_anomalies_flow()
    predictions = await score_predictions_flow()
    coocc = await refresh_cooccurrence_flow()
    return {
        "threads": threads,
        "anomalies": anomalies,
        "predictions": predictions,
        "cooccurrence": coocc,
    }


if __name__ == "__main__":
    asyncio.run(intelligence_all_flow())
