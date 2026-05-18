from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Thread(Base):
    """A multi-day narrative linking related stories over time."""

    __tablename__ = "thread"
    __table_args__ = (
        Index("ix_thread_status_last_updated", "status", "last_updated_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(300), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    narrative_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    story_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    velocity_history: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)


class ThreadStory(Base):
    """Membership of a Story in a Thread (m2m)."""

    __tablename__ = "thread_story"
    __table_args__ = (
        Index("ix_thread_story_thread_added", "thread_id", "story_added_at"),
    )

    thread_id: Mapped[int] = mapped_column(
        ForeignKey("thread.id", ondelete="CASCADE"), primary_key=True
    )
    story_id: Mapped[int] = mapped_column(
        ForeignKey("story.id", ondelete="CASCADE"), primary_key=True
    )
    story_added_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="escalation")
