from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Episode(Base):
    """A podcast episode (transcript + audio)."""

    __tablename__ = "episode"
    __table_args__ = (
        UniqueConstraint("podcast_source_id", "audio_url", name="uq_episode_source_audio"),
        Index("ix_episode_published_at", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    podcast_source_id: Mapped[int] = mapped_column(
        ForeignKey("podcast_source.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)

    story_id: Mapped[int | None] = mapped_column(
        ForeignKey("story.id", ondelete="SET NULL"), nullable=True, index=True
    )
    thread_id: Mapped[int | None] = mapped_column(
        ForeignKey("thread.id", ondelete="SET NULL"), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


class AudioBrief(Base):
    """A daily TTS-generated audio brief."""

    __tablename__ = "audio_brief"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    story_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
