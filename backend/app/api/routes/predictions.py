"""Predictions endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Prediction, Story
from app.schemas.intelligence import PredictionAccuracy, PredictionItem

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/rising", response_model=list[PredictionItem])
async def rising(
    db: AsyncSession = Depends(get_db),
    min_confidence: float = Query(0.5, ge=0, le=1),
    limit: int = Query(20, ge=1, le=100),
) -> list[PredictionItem]:
    # Latest prediction per story
    latest = (
        select(Prediction.story_id, func.max(Prediction.predicted_at).label("pa"))
        .group_by(Prediction.story_id)
        .subquery()
    )
    rows = (await db.execute(
        select(Prediction, Story.slug, Story.name, Story.source_count)
        .join(latest, (latest.c.story_id == Prediction.story_id) & (latest.c.pa == Prediction.predicted_at))
        .join(Story, Story.id == Prediction.story_id)
        .where(Prediction.confidence >= min_confidence)
        .order_by(desc(Prediction.confidence))
        .limit(limit)
    )).all()
    return [
        PredictionItem(
            story_id=p.story_id, story_slug=slug, story_name=name,
            source_count_now=sc,
            predicted_outlets_24h=p.predicted_outlets_24h,
            confidence=p.confidence, predicted_at=p.predicted_at,
        )
        for (p, slug, name, sc) in rows
    ]


@router.get("/accuracy", response_model=PredictionAccuracy)
async def accuracy(db: AsyncSession = Depends(get_db)) -> PredictionAccuracy:
    rows = (await db.execute(
        select(Prediction.correct).where(Prediction.correct.is_not(None))
    )).all()
    n = len(rows)
    correct = sum(1 for (c,) in rows if c)
    return PredictionAccuracy(
        total=n,
        correct=correct,
        accuracy=(correct / n if n else 0.0),
        avg_lead_hours=24.0,  # heuristic v1; refine after model is trained
    )
