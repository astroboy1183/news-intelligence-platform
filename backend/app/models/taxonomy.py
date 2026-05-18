from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Entity(Base):
    """A named entity (person, org, place, event) extracted from articles."""

    __tablename__ = "entity"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    canonical_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    wiki_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


class ArticleEntity(Base):
    """Article ↔ Entity mention (with count)."""

    __tablename__ = "article_entity"

    article_id: Mapped[int] = mapped_column(
        ForeignKey("article.id", ondelete="CASCADE"), primary_key=True
    )
    entity_id: Mapped[int] = mapped_column(
        ForeignKey("entity.id", ondelete="CASCADE"), primary_key=True
    )
    mention_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Topic(Base):
    """A keyword/phrase topic (KeyBERT-extracted)."""

    __tablename__ = "topic"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


class ArticleTopic(Base):
    """Article ↔ Topic with relevance score."""

    __tablename__ = "article_topic"

    article_id: Mapped[int] = mapped_column(
        ForeignKey("article.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topic.id", ondelete="CASCADE"), primary_key=True
    )
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)


class EntityCooccurrence(Base):
    """Precomputed entity-pair co-occurrence (for network graph)."""

    __tablename__ = "entity_cooccurrence"
    __table_args__ = (
        UniqueConstraint(
            "entity_a_id", "entity_b_id", "window_start",
            name="uq_entity_cooccurrence_pair_window",
        ),
        CheckConstraint("entity_a_id < entity_b_id", name="ck_entity_cooccurrence_order"),
        Index("ix_entity_cooccurrence_window_start", "window_start"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_a_id: Mapped[int] = mapped_column(
        ForeignKey("entity.id", ondelete="CASCADE"), nullable=False
    )
    entity_b_id: Mapped[int] = mapped_column(
        ForeignKey("entity.id", ondelete="CASCADE"), nullable=False
    )
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
