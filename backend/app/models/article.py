from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Article(Base):
    """A single article fetched from a Source."""

    __tablename__ = "article"
    __table_args__ = (
        Index("ix_article_published_at", "published_at"),
        Index("ix_article_story_id", "story_id"),
        Index("ix_article_title_hash_published_at", "title_hash", "published_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(
        ForeignKey("source.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(2000), unique=True, nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    title_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    lead: Mapped[str | None] = mapped_column(Text, nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    author: Mapped[str | None] = mapped_column(String(500), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    fetched_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="en")

    story_id: Mapped[int | None] = mapped_column(
        ForeignKey("story.id", ondelete="SET NULL"), nullable=True
    )

    embedding: Mapped[list[float] | None] = mapped_column(Vector(384), nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
