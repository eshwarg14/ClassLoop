"""In-process background asyncio job runner for processing queued lectures."""

from __future__ import annotations

import asyncio

from app.agents.orchestrator import OrchestratorAgent
from app.db.repo import (
    claim_pending_jobs,
    get_or_create_job,
    get_pending_jobs_on_startup,
    update_job_status,
    update_lecture_status,
)
from app.db.session import get_session_maker
from app.logging import get_logger

logger = get_logger("classloop.jobs")

RETRY_DELAYS = [1, 4, 16]  # Exponential backoff in seconds


class JobRunner:
    """
    In-process asynchronous job runner:
    - Periodically claims pending jobs from DB
    - Runs orchestrator pipeline for each job
    - Handles retries with exponential backoff (1s, 4s, 16s)
    - Marks failures with visible error reason
    - Resumes unfinished jobs on startup
    - Provides graceful shutdown
    """

    def __init__(self, poll_interval: float = 1.0) -> None:
        self.poll_interval = poll_interval
        self._running = False
        self._task: asyncio.Task | None = None
        self._orchestrator = OrchestratorAgent()
        self._queue_event = asyncio.Event()

    async def start(self) -> None:
        """Start the background worker task."""
        if self._running:
            return

        self._running = True
        logger.info("job_runner_starting")

        # Resume unfinished jobs on startup
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                resumed = await get_pending_jobs_on_startup(session)
                if resumed:
                    logger.info("resumed_pending_jobs_on_startup", count=len(resumed))
        except Exception as exc:
            logger.error("error_resuming_pending_jobs", error=str(exc))

        self._task = asyncio.create_task(self._worker_loop())
        logger.info("job_runner_started")

    async def stop(self) -> None:
        """Gracefully stop the background worker."""
        if not self._running:
            return

        logger.info("job_runner_stopping")
        self._running = False
        self._queue_event.set()

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        logger.info("job_runner_stopped")

    async def submit_job(self, lecture_id: str) -> None:
        """Submit or queue a lecture for background processing."""
        session_maker = get_session_maker()
        async with session_maker() as session:
            job, created = await get_or_create_job(session, lecture_id=lecture_id)
            if not created and job.status in ("failed", "completed"):
                # Reset to pending for retry
                await update_job_status(session, job_id=job.id, status="pending", error=None)

        # Notify worker loop
        self._queue_event.set()
        logger.info("job_submitted", lecture_id=lecture_id)

    async def _worker_loop(self) -> None:
        """Main loop polling for and executing pending jobs."""
        while self._running:
            try:
                try:
                    from app.api.webhook import check_silence_timeouts
                    await check_silence_timeouts()
                except Exception as st_exc:
                    logger.warning("silence_timeout_check_error", error=str(st_exc))

                processed_any = await self._process_next_job()
                if not processed_any:
                    # Wait for next job event or timeout
                    try:
                        await asyncio.wait_for(self._queue_event.wait(), timeout=self.poll_interval)
                        self._queue_event.clear()
                    except TimeoutError:
                        pass
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("job_worker_loop_error", error=str(exc))
                await asyncio.sleep(1.0)

    async def _process_next_job(self) -> bool:
        """Claim and execute a single pending job."""
        session_maker = get_session_maker()
        claimed_jobs = []

        async with session_maker() as session:
            claimed_jobs = await claim_pending_jobs(session, limit=1)

        if not claimed_jobs:
            return False

        job = claimed_jobs[0]
        job_id = job.id
        lecture_id = job.lecture_id
        attempt = job.attempts
        logger.info("job_execution_started", job_id=job_id, lecture_id=lecture_id, attempt=attempt)

        try:
            # Execute pipeline
            await self._orchestrator.run_pipeline(lecture_id=lecture_id, job_id=job_id)

            async with session_maker() as session:
                await update_job_status(session, job_id=job_id, status="completed", error=None)
            logger.info("job_execution_completed", job_id=job_id, lecture_id=lecture_id)
            return True

        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {str(exc)}"
            logger.error(
                "job_execution_failed",
                job_id=job_id,
                lecture_id=lecture_id,
                attempt=attempt,
                error=error_msg,
            )

            # Check if retry is allowed
            if attempt < job.max_attempts:
                # Schedule retry backoff
                backoff_idx = min(attempt - 1, len(RETRY_DELAYS) - 1)
                delay_sec = RETRY_DELAYS[backoff_idx]
                logger.info(
                    "job_retrying_after_backoff",
                    job_id=job_id,
                    attempt=attempt,
                    delay_sec=delay_sec,
                )
                await asyncio.sleep(delay_sec)

                async with session_maker() as session:
                    # Put back into pending state for retry
                    await update_job_status(session, job_id=job_id, status="pending", error=error_msg)
            else:
                # Exhausted attempts: mark permanently failed
                async with session_maker() as session:
                    await update_job_status(session, job_id=job_id, status="failed", error=error_msg)
                    await update_lecture_status(session, lecture_id=lecture_id, status="failed")
                logger.error("job_max_attempts_exhausted", job_id=job_id, lecture_id=lecture_id)

            return True


_global_job_runner: JobRunner | None = None


def get_job_runner() -> JobRunner:
    global _global_job_runner
    if _global_job_runner is None:
        _global_job_runner = JobRunner()
    return _global_job_runner
