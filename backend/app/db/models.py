"""SQLAlchemy 2.0 database models."""

import uuid
from datetime import UTC, datetime
from typing import Any, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    """Current UTC datetime helper."""
    return datetime.now(UTC)


def generate_uuid() -> str:
    """Generate string UUID."""
    return str(uuid.uuid4())


class Lecture(Base):
    """Lecture session model."""

    __tablename__ = "lectures"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True, default="u1")
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Lecture")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="live", index=True)
    session_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="lecture", uselist=False, cascade="all, delete-orphan")
    outputs: Mapped[list["Output"]] = relationship("Output", back_populates="lecture", cascade="all, delete-orphan")
    traces: Mapped[list["AgentTrace"]] = relationship("AgentTrace", back_populates="lecture", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_lectures_user_status", "user_id", "status"),
    )


class Job(Base):
    """Background pipeline job for processing a lecture."""

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    lecture_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("lectures.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    lecture: Mapped["Lecture"] = relationship("Lecture", back_populates="job")

    __table_args__ = (
        Index("ix_jobs_status_attempts", "status", "attempts"),
    )


class Output(Base):
    """Generated outputs (notes, quiz, schedule) for a lecture."""

    __tablename__ = "outputs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    lecture_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    output_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # notes, quiz, schedule
    content: Mapped[Any] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    lecture: Mapped["Lecture"] = relationship("Lecture", back_populates="outputs")

    __table_args__ = (
        Index("ix_outputs_lecture_type", "lecture_id", "output_type"),
    )


class AgentTrace(Base):
    """Observable trace log for each agent invocation in the multi-agent pipeline."""

    __tablename__ = "agent_traces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    lecture_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    agent_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    input_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    output: Mapped[Any | None] = mapped_column(JSON, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="completed", nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # Relationships
    lecture: Mapped["Lecture"] = relationship("Lecture", back_populates="traces")


class Setting(Base):
    """Encrypted settings stored in database."""

    __tablename__ = "settings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="ui", nullable=False)  # env or ui
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
