"""Asynchronous repository functions for database operations."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AgentTrace, Job, Lecture, Output, Setting, generate_uuid, utcnow

# ==============================================================================
# Lectures CRUD
# ==============================================================================

async def create_lecture(
    session: AsyncSession,
    user_id: str = "u1",
    title: str = "Untitled Lecture",
    session_id: str | None = None,
    lecture_id: str | None = None,
) -> Lecture:
    """Create a new lecture record."""
    lecture = Lecture(
        id=lecture_id or generate_uuid(),
        user_id=user_id,
        title=title,
        status="live",
        session_id=session_id,
    )
    session.add(lecture)
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def get_lecture(session: AsyncSession, lecture_id: str) -> Lecture | None:
    """Retrieve a lecture by ID."""
    stmt = select(Lecture).where(Lecture.id == lecture_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_lectures(
    session: AsyncSession,
    user_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[Lecture]:
    """List lectures ordered by creation date descending."""
    stmt = select(Lecture)
    if user_id:
        stmt = stmt.where(Lecture.user_id == user_id)
    stmt = stmt.order_by(Lecture.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return result.scalars().all()


async def update_lecture_status(
    session: AsyncSession,
    lecture_id: str,
    status: str,
    ended_at: datetime | None = None,
) -> Lecture | None:
    """Update lecture status and optionally ended_at."""
    lecture = await get_lecture(session, lecture_id)
    if not lecture:
        return None
    lecture.status = status
    if ended_at:
        lecture.ended_at = ended_at
    elif status in ("ready", "failed") and not lecture.ended_at:
        lecture.ended_at = utcnow()
    lecture.updated_at = utcnow()
    await session.commit()
    await session.refresh(lecture)
    return lecture


async def delete_lecture(session: AsyncSession, lecture_id: str) -> bool:
    """Delete a lecture and associated records by cascade."""
    stmt = delete(Lecture).where(Lecture.id == lecture_id)
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0


# ==============================================================================
# Jobs CRUD & Queue Operations
# ==============================================================================

async def get_job_by_lecture_id(session: AsyncSession, lecture_id: str) -> Job | None:
    """Get job for a lecture."""
    stmt = select(Job).where(Job.lecture_id == lecture_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_or_create_job(session: AsyncSession, lecture_id: str) -> tuple[Job, bool]:
    """Idempotently get or create a processing job for a lecture."""
    job = await get_job_by_lecture_id(session, lecture_id)
    if job:
        return job, False

    job = Job(
        lecture_id=lecture_id,
        status="pending",
        attempts=0,
        max_attempts=3,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return job, True


async def claim_pending_jobs(session: AsyncSession, limit: int = 1) -> list[Job]:
    """Atomically claim pending jobs for processing."""
    stmt = (
        select(Job)
        .where(Job.status == "pending", Job.attempts < Job.max_attempts)
        .order_by(Job.created_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    result = await session.execute(stmt)
    jobs = list(result.scalars().all())

    now = utcnow()
    for job in jobs:
        job.status = "running"
        job.started_at = now
        job.attempts += 1
        job.updated_at = now

    if jobs:
        await session.commit()
        for job in jobs:
            await session.refresh(job)

    return jobs


async def update_job_status(
    session: AsyncSession,
    job_id: str,
    status: str,
    error: str | None = None,
) -> Job | None:
    """Update a job status, completion timestamp, and error."""
    stmt = select(Job).where(Job.id == job_id)
    result = await session.execute(stmt)
    job = result.scalar_one_or_none()
    if not job:
        return None

    now = utcnow()
    job.status = status
    job.updated_at = now
    if error is not None:
        job.error = error
    if status in ("completed", "failed"):
        job.completed_at = now

    await session.commit()
    await session.refresh(job)
    return job


async def get_pending_jobs_on_startup(session: AsyncSession) -> Sequence[Job]:
    """Retrieve all pending or interrupted (running) jobs to resume on startup."""
    # Reset any jobs that were 'running' during shutdown back to 'pending' if attempts remain
    reset_stmt = (
        update(Job)
        .where(Job.status == "running", Job.attempts < Job.max_attempts)
        .values(status="pending", updated_at=utcnow())
    )
    await session.execute(reset_stmt)
    await session.commit()

    fetch_stmt = (
        select(Job)
        .where(Job.status == "pending", Job.attempts < Job.max_attempts)
        .order_by(Job.created_at.asc())
    )
    res = await session.execute(fetch_stmt)
    return res.scalars().all()


# ==============================================================================
# Outputs CRUD
# ==============================================================================

async def save_output(
    session: AsyncSession,
    lecture_id: str,
    output_type: str,
    content: Any,
) -> Output:
    """Save or update generated output for a lecture."""
    # Check if exists
    stmt = select(Output).where(Output.lecture_id == lecture_id, Output.output_type == output_type)
    res = await session.execute(stmt)
    output = res.scalar_one_or_none()

    if output:
        output.content = content
        output.created_at = utcnow()
    else:
        output = Output(
            lecture_id=lecture_id,
            output_type=output_type,
            content=content,
        )
        session.add(output)

    await session.commit()
    await session.refresh(output)
    return output


async def get_outputs_for_lecture(session: AsyncSession, lecture_id: str) -> Sequence[Output]:
    """Get all generated outputs for a lecture."""
    stmt = select(Output).where(Output.lecture_id == lecture_id)
    result = await session.execute(stmt)
    return result.scalars().all()


async def get_output(
    session: AsyncSession, lecture_id: str, output_type: str
) -> Output | None:
    """Get specific output type for a lecture."""
    stmt = select(Output).where(
        Output.lecture_id == lecture_id, Output.output_type == output_type
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


# ==============================================================================
# AgentTrace CRUD
# ==============================================================================

async def record_agent_trace(
    session: AsyncSession,
    lecture_id: str,
    agent_name: str,
    job_id: str | None = None,
    input_hash: str | None = None,
    output: Any | None = None,
    latency_ms: int = 0,
    status: str = "completed",
    error: str | None = None,
) -> AgentTrace:
    """Record an agent execution trace."""
    trace = AgentTrace(
        lecture_id=lecture_id,
        job_id=job_id,
        agent_name=agent_name,
        input_hash=input_hash,
        output=output,
        latency_ms=latency_ms,
        status=status,
        error=error,
    )
    session.add(trace)
    await session.commit()
    await session.refresh(trace)
    return trace


async def get_traces_for_lecture(session: AsyncSession, lecture_id: str) -> Sequence[AgentTrace]:
    """Get all agent traces for a lecture ordered by time."""
    stmt = (
        select(AgentTrace)
        .where(AgentTrace.lecture_id == lecture_id)
        .order_by(AgentTrace.created_at.asc())
    )
    result = await session.execute(stmt)
    return result.scalars().all()


# ==============================================================================
# Settings CRUD
# ==============================================================================

async def get_setting(session: AsyncSession, key: str) -> Setting | None:
    """Retrieve an encrypted setting by key."""
    stmt = select(Setting).where(Setting.key == key)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_setting(
    session: AsyncSession,
    key: str,
    encrypted_value: str,
    source: str = "ui",
) -> Setting:
    """Upsert an encrypted setting."""
    setting = await get_setting(session, key)
    now = utcnow()
    if setting:
        setting.encrypted_value = encrypted_value
        setting.source = source
        setting.updated_at = now
    else:
        setting = Setting(
            key=key,
            encrypted_value=encrypted_value,
            source=source,
            updated_at=now,
        )
        session.add(setting)
    await session.commit()
    await session.refresh(setting)
    return setting


async def list_settings(session: AsyncSession) -> Sequence[Setting]:
    """List all stored settings."""
    stmt = select(Setting).order_by(Setting.key.asc())
    result = await session.execute(stmt)
    return result.scalars().all()


async def delete_setting(session: AsyncSession, key: str) -> bool:
    """Delete a setting by key."""
    stmt = delete(Setting).where(Setting.key == key)
    result = await session.execute(stmt)
    await session.commit()
    return result.rowcount > 0
