from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Story(Base):
    """A cluster of articles covering the same event."""

    __tablename__ = "story"
    __table_args__ = (
        Index("ix_story_first_seen_at", "first_seen_at"),
        Index("ix_story_last_updated_at", "last_updated_at"),
        Index("ix_story_velocity_score", "velocity_score"),
        Index("ix_story_primary_country_state", "primary_country", "primary_state"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    tldr: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    centroid_embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)

    first_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    article_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    velocity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    velocity_history: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)

    primary_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    first_reported_by_source_id: Mapped[int | None] = mapped_column(
        ForeignKey("source.id", ondelete="SET NULL"), nullable=True
    )

    thread_id: Mapped[int | None] = mapped_column(
        ForeignKey("thread.id", ondelete="SET NULL"), nullable=True, index=True
    )
