"""Confusion Detector agent: Groups chunks, re-scores confusion, and outputs topics."""

from __future__ import annotations

import time
from typing import Any

from pydantic import ValidationError

from app.adapters.lyzr_adapter import call_agent
from app.agents.schemas import DetectorOutput
from app.config import get_settings
from app.db.repo import record_agent_trace
from app.db.session import get_session_maker
from app.logging import get_logger

logger = get_logger("classloop.agent.detector")


class ConfusionDetectorAgent:
    """
    Confusion Detector agent:
    - Takes chunks from Qdrant
    - Calls Lyzr (or mock) to cluster into topics and re-score with LLM judge
    - Merges LLM scores with live rule-based scores
    - Returns DetectorOutput validated by Pydantic
    - On validation error, retries once
    - Records trace in DB
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def run(
        self,
        lecture_id: str,
        chunks: list[dict[str, Any]],
        job_id: str | None = None,
    ) -> DetectorOutput:
        start_time = time.perf_counter()
        agent_name = "confusion_detector"
        agent_id = self.settings.LYZR_DETECTOR_AGENT_ID

        prompt = (
            "Analyze these lecture transcript chunks. Group them into cohesive pedagogical topics. "
            "For each topic, evaluate student comprehension and assign a confusion score between 0.0 and 1.0, "
            "listing specific detected reasons."
        )
        context = {
            "lecture_id": lecture_id,
            "chunks": [c.get("payload", c) for c in chunks],
        }

        # Attempt call with 1 retry on validation failure
        raw_output = None
        error_msg = None
        validated_output: DetectorOutput | None = None

        for attempt in range(2):
            try:
                raw_output = await call_agent(
                    agent_id=agent_id,
                    prompt=prompt if attempt == 0 else f"{prompt}\n(Previous error: {error_msg}. Please return valid JSON matching the schema.)",
                    context=context,
                    task_type="detector",
                )
                validated_output = DetectorOutput.model_validate(raw_output)
                break
            except ValidationError as ve:
                error_msg = str(ve)
                logger.warning("detector_validation_retry", attempt=attempt, error=error_msg)
                if attempt == 1:
                    raise
            except Exception as exc:
                error_msg = str(exc)
                logger.error("detector_agent_failed", attempt=attempt, error=error_msg)
                if attempt == 1:
                    raise

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
                    output=validated_output.model_dump() if validated_output else None,
                    latency_ms=latency_ms,
                    status="completed" if validated_output else "failed",
                    error=error_msg,
                )
        except Exception as trace_exc:
            logger.warning("trace_save_failed", error=str(trace_exc))

        if not validated_output:
            raise RuntimeError(f"Detector agent failed: {error_msg}")

        return validated_output
