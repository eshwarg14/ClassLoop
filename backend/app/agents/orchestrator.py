"""Orchestrator Agent: Coordinates end-of-lecture processing pipeline."""

from __future__ import annotations

import base64
import time
from typing import Any

from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.agents.confusion_detector import ConfusionDetectorAgent
from app.agents.content_agent import ContentAgent
from app.agents.scheduler_agent import SchedulerAgent
from app.core.events import get_event_bus
from app.db.repo import (
    get_lecture,
    record_agent_trace,
    save_output,
    update_lecture_status,
)
from app.db.session import get_session_maker
from app.logging import get_logger

logger = get_logger("classloop.orchestrator")


class OrchestratorAgent:
    """
    Sequences the end-of-lecture processing pipeline:
    1. Load chunks from Qdrant for the lecture
    2. Run Confusion Detector
    3. Run Content Agent (notes + quiz + cross-lecture links)
    4. Run Scheduler Agent
    5. Save all outputs to DB
    6. Emit SSE events for each step and output_ready
    7. Update lecture status to 'ready'
    """

    def __init__(self) -> None:
        self.qdrant = get_qdrant_store_adapter()
        self.detector_agent = ConfusionDetectorAgent()
        self.content_agent = ContentAgent()
        self.scheduler_agent = SchedulerAgent()
        self.event_bus = get_event_bus()

    async def run_pipeline(self, lecture_id: str, job_id: str | None = None) -> dict[str, Any]:
        pipeline_start = time.perf_counter()
        logger.info("pipeline_started", lecture_id=lecture_id, job_id=job_id)
        session_maker = get_session_maker()

        # Step 0: Get lecture details
        async with session_maker() as session:
            lecture = await get_lecture(session, lecture_id)
            if not lecture:
                raise ValueError(f"Lecture {lecture_id} not found in database")
            user_id = lecture.user_id
            title = lecture.title
            lecture_date = lecture.created_at.date().isoformat()

        # Step 1: Load chunks from Qdrant
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "loading_chunks", "status": "running"},
        )
        chunks = self.qdrant.get_lecture_chunks(lecture_id=lecture_id, user_id=user_id)
        if not chunks:
            logger.warning("no_chunks_found_in_qdrant", lecture_id=lecture_id)
            # Synthesize fallback chunk if Qdrant has not received any to avoid pipeline stalling
            chunks = [{
                "id": "synthetic_0",
                "payload": {
                    "lecture_id": lecture_id,
                    "chunk_index": 0,
                    "text": f"Lecture notes and review material for {title}.",
                    "speaker": "lecturer",
                    "confusion_score": 0.5,
                    "reasons": ["Introductory lecture material"],
                }
            }]

        # Step 2: Run Confusion Detector
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "confusion_detector", "status": "running"},
        )
        detector_out = await self.detector_agent.run(
            lecture_id=lecture_id,
            chunks=chunks,
            job_id=job_id,
        )
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "confusion_detector", "status": "completed", "topics_count": len(detector_out.topics)},
        )

        # Step 3: Run Content Agent
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "content_agent", "status": "running"},
        )
        notes_out, quiz_out, cross_links = await self.content_agent.run(
            lecture_id=lecture_id,
            user_id=user_id,
            lecture_title=title,
            chunks=chunks,
            topics=detector_out.topics,
            job_id=job_id,
        )
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "content_agent", "status": "completed"},
        )

        # Step 4: Run Scheduler Agent
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "scheduler_agent", "status": "running"},
        )
        schedule_out, ics_bytes = await self.scheduler_agent.run(
            lecture_id=lecture_id,
            lecture_title=title,
            topics=detector_out.topics,
            lecture_date=lecture_date,
            job_id=job_id,
        )
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="agent_step",
            data={"step": "scheduler_agent", "status": "completed"},
        )

        total_latency_ms = int((time.perf_counter() - pipeline_start) * 1000)

        # Step 5: Save all outputs and orchestrator trace to DB
        async with session_maker() as session:
            await save_output(
                session=session,
                lecture_id=lecture_id,
                output_type="topics",
                content=detector_out.model_dump(),
            )
            await save_output(
                session=session,
                lecture_id=lecture_id,
                output_type="notes",
                content=notes_out.model_dump(),
            )
            await save_output(
                session=session,
                lecture_id=lecture_id,
                output_type="quiz",
                content=quiz_out.model_dump(),
            )
            await save_output(
                session=session,
                lecture_id=lecture_id,
                output_type="schedule",
                content={
                    "schedule": schedule_out.model_dump(),
                    "ics_base64": base64.b64encode(ics_bytes).decode("ascii"),
                },
            )
            await save_output(
                session=session,
                lecture_id=lecture_id,
                output_type="cross_links",
                content=[link.model_dump() for link in cross_links],
            )
            await record_agent_trace(
                session=session,
                lecture_id=lecture_id,
                job_id=job_id,
                agent_name="orchestrator",
                output={
                    "chunks_processed": len(chunks),
                    "topics_detected": len(detector_out.topics),
                    "quiz_questions": len(quiz_out.questions),
                    "revision_events": len(schedule_out.events),
                },
                latency_ms=total_latency_ms,
                status="completed",
            )

            # Step 6 & 7: Update lecture status to 'ready'
            await update_lecture_status(session, lecture_id=lecture_id, status="ready")

        # Emit output_ready SSE events
        await self.event_bus.emit(
            lecture_id=lecture_id,
            event_type="output_ready",
            data={"output_types": ["topics", "notes", "quiz", "schedule", "cross_links"]},
        )

        logger.info("pipeline_completed_successfully", lecture_id=lecture_id)
        return {
            "topics": detector_out.model_dump(),
            "notes": notes_out.model_dump(),
            "quiz": quiz_out.model_dump(),
            "schedule": schedule_out.model_dump(),
        }
