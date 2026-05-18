from datetime import date, datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IngestionRun(Base):
    """One ingestion attempt for one source."""

    __tablename__ = "ingestion_run"
    __table_args__ = (
        Index("ix_ingestion_run_source_started", "source_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("source.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    articles_seen: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    articles_inserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    articles_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class Prediction(Base):
    """A 'will blow up' prediction made on a low-coverage story."""

    __tablename__ = "prediction"
    __table_args__ = (
        Index("ix_prediction_predicted_at", "predicted_at"),
        Index("ix_prediction_confidence", "confidence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    story_id: Mapped[int] = mapped_column(
        ForeignKey("story.id", ondelete="CASCADE"), nullable=False, index=True
    )
    predicted_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    predicted_outlets_24h: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    feature_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    outcome_outlets_24h: Mapped[int | None] = mapped_column(Integer, nullable=True)
    correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)


class Anomaly(Base):
    """A detected anomaly: surge, silence, novel entity, coverage gap."""

    __tablename__ = "anomaly"
    __table_args__ = (
        Index("ix_anomaly_detected_at", "detected_at"),
        Index("ix_anomaly_type_severity", "type", "severity"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_entity_id: Mapped[int | None] = mapped_column(
        ForeignKey("entity.id", ondelete="CASCADE"), nullable=True
    )
    target_story_id: Mapped[int | None] = mapped_column(
        ForeignKey("story.id", ondelete="CASCADE"), nullable=True
    )
    severity: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    detected_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class DailySnapshot(Base):
    """A daily summary used to compute 'what changed since yesterday'."""

    __tablename__ = "daily_snapshot"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    top_stories: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    anomalies: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    regional_pulse: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
