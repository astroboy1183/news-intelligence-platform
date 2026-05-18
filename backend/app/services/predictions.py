"""Heuristic 'will blow up' scoring.

For stories currently under 5 outlets, predict whether they'll reach ≥20
outlets in the next 24 hours. v1 uses a hand-tuned linear blend of features;
v2 will train a lightgbm model on backfilled outcomes once we have data.
"""

from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article, Prediction, Source, Story

LOW_COVERAGE_THRESHOLD = 5
TIER_A_BONUS = 0.25


@dataclass
class _Features:
    source_count_now: int
    unique_countries: int
    tier_a_present: bool
    velocity_per_hour: float
    age_hours: float


def _score(f: _Features) -> tuple[int, float, dict]:
    """Return (predicted_outlets_24h, confidence_0_1, feature_snapshot)."""
    diversity = min(f.unique_countries / 3.0, 1.0)
    tier = TIER_A_BONUS if f.tier_a_present else 0.0
    velocity = min(f.velocity_per_hour / 3.0, 1.0)
    # younger stories with strong signals have more upside.
    age_factor = max(0.0, 1.0 - (f.age_hours / 24.0))

    score = 0.4 * diversity + 0.3 * velocity + 0.2 * age_factor + tier
    score = max(0.0, min(score, 1.0))

    predicted_added = int(20 * score)
    predicted = f.source_count_now + predicted_added
    confidence = score
    snapshot = {
        "source_count_now": f.source_count_now,
        "unique_countries": f.unique_countries,
        "tier_a_present": f.tier_a_present,
        "velocity_per_hour": round(f.velocity_per_hour, 2),
        "age_hours": round(f.age_hours, 2),
        "blend_score": round(score, 3),
    }
    return predicted, round(confidence, 3), snapshot


async def _features_for_story(session: AsyncSession, story_id: int) -> _Features | None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    stmt = (
        select(Article.fetched_at, Source.country, Source.tier)
        .join(Source, Source.id == Article.source_id)
        .where(Article.story_id == story_id)
    )
    rows = (await session.execute(stmt)).all()
    if not rows:
        return None

    fetched_times = [r[0] for r in rows if r[0]]
    countries = {r[1] for r in rows if r[1]}
    tiers = {r[2] for r in rows if r[2]}
    if not fetched_times:
        return None

    earliest = min(fetched_times)
    age_hours = max(0.01, (datetime.now(timezone.utc) - earliest).total_seconds() / 3600.0)
    recent = sum(1 for t in fetched_times if t >= cutoff)
    velocity = recent / min(age_hours, 12.0)
    return _Features(
        source_count_now=len({r[1] for r in rows}),  # unique source slots ≈ source_count
        unique_countries=len(countries),
        tier_a_present="A" in tiers,
        velocity_per_hour=velocity,
        age_hours=age_hours,
    )


async def score_predictions(session: AsyncSession) -> dict:
    """Score all currently-low-coverage stories."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    candidate_stmt = (
        select(Story.id)
        .where(
            Story.source_count < LOW_COVERAGE_THRESHOLD,
            Story.source_count >= 1,
            Story.last_updated_at >= cutoff,
        )
    )
    ids = [r[0] for r in (await session.execute(candidate_stmt)).all()]
    written = 0
    for sid in ids:
        feats = await _features_for_story(session, sid)
        if feats is None:
            continue
        predicted, confidence, snapshot = _score(feats)
        if confidence < 0.30:
            continue
        session.add(Prediction(
            story_id=sid,
            predicted_outlets_24h=predicted,
            confidence=confidence,
            feature_snapshot=snapshot,
        ))
        written += 1
    await session.commit()
    logger.info(f"scored {written}/{len(ids)} stories above confidence threshold")
    return {"candidates": len(ids), "predictions_written": written}


async def backfill_prediction_outcomes(session: AsyncSession) -> dict:
    """Fill outcome_outlets_24h for predictions ≥24h old."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    open_stmt = (
        select(Prediction.id, Prediction.story_id, Prediction.predicted_outlets_24h)
        .where(Prediction.outcome_outlets_24h.is_(None), Prediction.predicted_at <= cutoff)
    )
    rows = (await session.execute(open_stmt)).all()
    updated = 0
    for pred_id, story_id, predicted in rows:
        story = await session.get(Story, story_id)
        if story is None:
            continue
        actual = story.source_count
        pred = await session.get(Prediction, pred_id)
        pred.outcome_outlets_24h = actual
        pred.correct = actual >= predicted
        updated += 1
    await session.commit()
    return {"updated": updated}
