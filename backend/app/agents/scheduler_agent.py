"""Scheduler Agent: Generates spaced repetition review events and .ics calendar files."""

from __future__ import annotations

import time
from datetime import date

from app.adapters.lyzr_adapter import call_agent
from app.agents.schemas import ScheduleOutput, Topic
from app.config import get_settings
from app.core.ics import generate_revision_ics
from app.db.repo import record_agent_trace
from app.db.session import get_session_maker
from app.logging import get_logger

logger = get_logger("classloop.agent.scheduler")


class SchedulerAgent:
    """
    Scheduler Agent:
    - Takes topics with scores
    - Generates spaced repetition revision schedule using scheduler_rules
    - Generates .ics calendar file
    - Returns ScheduleOutput and .ics byte content
    - Records trace in DB
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def run(
        self,
        lecture_id: str,
        lecture_title: str,
        topics: list[Topic],
        lecture_date: str | None = None,
        job_id: str | None = None,
    ) -> tuple[ScheduleOutput, bytes]:
        start_time = time.perf_counter()
        agent_name = "scheduler_agent"
        agent_id = self.settings.LYZR_SCHEDULER_AGENT_ID

        date_val = lecture_date or date.today().isoformat()
        topics_dicts = [t.model_dump() for t in topics]

        context = {
            "lecture_id": lecture_id,
            "lecture_title": lecture_title,
            "lecture_date": date_val,
            "topics": topics_dicts,
        }

        # Generate schedule via rules or Lyzr delegation (with 1-retry on validation error)
        from pydantic import ValidationError

        schedule_output: ScheduleOutput | None = None
        sched_error = None
        prompt = "Generate spaced repetition revision schedule based on topic confusion scores."

        for attempt in range(2):
            try:
                raw_output = await call_agent(
                    agent_id=agent_id,
                    prompt=prompt if attempt == 0 else f"{prompt}\n(Previous error: {sched_error}. Return valid JSON.)",
                    context=context,
                    task_type="scheduler",
                )
                schedule_output = ScheduleOutput.model_validate(raw_output)
                break
            except ValidationError as ve:
                sched_error = str(ve)
                logger.warning("scheduler_validation_retry", attempt=attempt, error=sched_error)
                if attempt == 1:
                    raise
            except Exception as exc:
                sched_error = str(exc)
                logger.error("scheduler_agent_failed", attempt=attempt, error=sched_error)
                if attempt == 1:
                    raise

        if not schedule_output:
            raise RuntimeError(f"Scheduler agent failed: {sched_error}")

        # Generate iCalendar bytes
        ics_bytes = generate_revision_ics(
            events=schedule_output.events,
            lecture_title=lecture_title,
        )

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        # Record DB trace
        try:
            session_maker = get_session_maker()
            async with session_maker() as session:
                await record_agent_trace(
                    session=session,
                    lecture_id=lecture_id,
                    job_id=job_id,
                    agent_name=agent_name,
                    output={
                        "event_count": len(schedule_output.events),
                        "lecture_date": schedule_output.lecture_date,
                    },
                    latency_ms=latency_ms,
                    status="completed",
                )
        except Exception as trace_exc:
            logger.warning("trace_save_failed", error=str(trace_exc))

        return schedule_output, ics_bytes
