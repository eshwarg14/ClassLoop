"""Content Agent: Generates notes and quiz weighted by confusion, and links cross-lecture concepts."""

from __future__ import annotations

import time
from typing import Any

from pydantic import ValidationError

from app.adapters.lyzr_adapter import call_agent
from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.agents.schemas import (
    CrossLectureLink,
    NotesOutput,
    QuizOutput,
    Topic,
)
from app.config import get_settings
from app.core.embedder import embed_text
from app.db.repo import record_agent_trace
from app.db.session import get_session_maker
from app.logging import get_logger

logger = get_logger("classloop.agent.content")


class ContentAgent:
    """
    Content Agent:
    - Takes topics + chunks
    - Generates notes (extra depth & 'Explained simply' callouts on flagged topics)
    - Generates quiz (weighted by confusion, each with source citation)
    - Searches Qdrant for similar chunks in other lectures (cross-lecture linking)
    - Returns (NotesOutput, QuizOutput, list[CrossLectureLink])
    - Retries once on validation error
    - Records trace in DB
    """

    def __init__(self) -> None:
        self.settings = get_settings()
        self.qdrant = get_qdrant_store_adapter()

    async def run(
        self,
        lecture_id: str,
        user_id: str,
        lecture_title: str,
        chunks: list[dict[str, Any]],
        topics: list[Topic],
        job_id: str | None = None,
    ) -> tuple[NotesOutput, QuizOutput, list[CrossLectureLink]]:
        start_time = time.perf_counter()
        agent_name = "content_agent"
        agent_id = self.settings.LYZR_CONTENT_AGENT_ID

        clean_chunks = [c.get("payload", c) for c in chunks]
        topics_dicts = [t.model_dump() for t in topics]

        context = {
            "lecture_id": lecture_id,
            "lecture_title": lecture_title,
            "user_id": user_id,
            "chunks": clean_chunks,
            "topics": topics_dicts,
        }

        # 1. Notes Generation (with retry)
        notes_prompt = (
            f"Generate comprehensive study notes for lecture '{lecture_title}'. "
            f"For topics with confusion score >= 0.4, provide an 'explained_simply' block."
        )
        validated_notes: NotesOutput | None = None
        notes_error = None

        for attempt in range(2):
            try:
                raw_notes = await call_agent(
                    agent_id=agent_id,
                    prompt=notes_prompt if attempt == 0 else f"{notes_prompt}\n(Fix format: {notes_error})",
                    context=context,
                    task_type="content_notes",
                )
                validated_notes = NotesOutput.model_validate(raw_notes)
                break
            except ValidationError as ve:
                notes_error = str(ve)
                logger.warning("notes_validation_retry", attempt=attempt, error=notes_error)
                if attempt == 1:
                    raise
            except Exception as exc:
                notes_error = str(exc)
                logger.error("notes_generation_failed", attempt=attempt, error=notes_error)
                if attempt == 1:
                    raise

        # 2. Quiz Generation (with retry)
        quiz_prompt = (
            f"Generate multiple choice quiz questions for '{lecture_title}' weighted heavily towards "
            f"the most confusing topics. Cite source_chunk_index and source_text_snippet for every question."
        )
        validated_quiz: QuizOutput | None = None
        quiz_error = None

        for attempt in range(2):
            try:
                raw_quiz = await call_agent(
                    agent_id=agent_id,
                    prompt=quiz_prompt if attempt == 0 else f"{quiz_prompt}\n(Fix format: {quiz_error})",
                    context=context,
                    task_type="content_quiz",
                )
                validated_quiz = QuizOutput.model_validate(raw_quiz)
                break
            except ValidationError as ve:
                quiz_error = str(ve)
                logger.warning("quiz_validation_retry", attempt=attempt, error=quiz_error)
                if attempt == 1:
                    raise
            except Exception as exc:
                quiz_error = str(exc)
                logger.error("quiz_generation_failed", attempt=attempt, error=quiz_error)
                if attempt == 1:
                    raise

        # 3. Cross-lecture Linking
        cross_links: list[CrossLectureLink] = []
        try:
            for topic in topics:
                t_vec = embed_text(topic.name + " " + topic.summary)
                matches = self.qdrant.search_similar(
                    query_embedding=t_vec,
                    user_id=user_id,
                    limit=2,
                    exclude_lecture_id=lecture_id,
                )
                for m in matches:
                    payload = m.get("payload", {})
                    other_lec_id = payload.get("lecture_id")
                    if other_lec_id and other_lec_id != lecture_id:
                        cross_links.append(
                            CrossLectureLink(
                                lecture_id=other_lec_id,
                                lecture_title=payload.get("lecture_title", f"Lecture {other_lec_id[:8]}"),
                                chunk_text=payload.get("text", "")[:150],
                                similarity_score=round(m.get("score", 0.0), 3),
                                topic=topic.name,
                            )
                        )
        except Exception as link_exc:
            logger.warning("cross_lecture_linking_failed", error=str(link_exc))

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
                        "notes_title": validated_notes.title if validated_notes else "",
                        "quiz_count": len(validated_quiz.questions) if validated_quiz else 0,
                        "cross_links_count": len(cross_links),
                    },
                    latency_ms=latency_ms,
                    status="completed" if (validated_notes and validated_quiz) else "failed",
                    error=notes_error or quiz_error,
                )
        except Exception as trace_exc:
            logger.warning("trace_save_failed", error=str(trace_exc))

        if not validated_notes or not validated_quiz:
            raise RuntimeError(f"Content agent failed: notes={notes_error}, quiz={quiz_error}")

        return validated_notes, validated_quiz, cross_links
