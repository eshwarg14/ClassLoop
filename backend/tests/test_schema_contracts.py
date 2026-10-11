"""Schema validation and agent retry contract tests."""

from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.agents.confusion_detector import ConfusionDetectorAgent
from app.agents.content_agent import ContentAgent
from app.agents.schemas import (
    AskCitation,
    AskResponse,
    DetectorOutput,
    NoteSection,
    NotesOutput,
    QuizOutput,
    QuizQuestion,
    RevisionEvent,
    ScheduleOutput,
    Topic,
)


def test_detector_output_schema_validation():
    """Valid DetectorOutput passes; out-of-bounds confusion_score raises ValidationError."""
    valid = DetectorOutput(
        topics=[
            Topic(
                name="Deadlock Avoidance",
                confusion_score=0.75,
                reasons=["Student question"],
                chunk_indices=[1, 2],
                summary="Covers Banker's Algorithm.",
            )
        ],
        overall_score=0.75,
    )
    assert valid.overall_score == 0.75
    assert len(valid.topics) == 1

    with pytest.raises(ValidationError):
        DetectorOutput(
            topics=[Topic(name="Invalid Score", confusion_score=1.5)],
            overall_score=0.5,
        )


def test_notes_output_schema_validation():
    """Valid NotesOutput with flagged section and explained_simply passes validation."""
    notes = NotesOutput(
        title="Study Notes: Deadlocks",
        summary="Overview of deadlock conditions.",
        sections=[
            NoteSection(
                topic="Coffman Conditions",
                content_markdown="### Four Conditions\n- Mutual Exclusion",
                is_flagged=True,
                explained_simply="Like four cars at a 4-way stop.",
            )
        ],
    )
    assert notes.sections[0].is_flagged is True
    assert notes.sections[0].explained_simply is not None


def test_quiz_output_schema_validation():
    """Valid QuizOutput requires source_chunk_index and source_text_snippet on every question."""
    quiz = QuizOutput(
        title="Deadlock Quiz",
        questions=[
            QuizQuestion(
                question="Which condition prevents forcible resource removal?",
                options=["Mutual Exclusion", "No Preemption", "Hold and Wait", "Circular Wait"],
                correct_index=1,
                explanation="No Preemption means resources cannot be forcibly taken.",
                source_chunk_index=2,
                source_text_snippet="Condition three is No Preemption...",
            )
        ],
    )
    assert len(quiz.questions) == 1
    assert quiz.questions[0].source_chunk_index == 2

    with pytest.raises(ValidationError):
        QuizQuestion(
            question="Missing citation question",
            options=["A", "B"],
            correct_index=0,
            explanation="Explanation",
            # Missing source_chunk_index and source_text_snippet
        )


def test_schedule_output_schema_validation():
    """Valid ScheduleOutput validates lecture_date and RevisionEvent list."""
    sched = ScheduleOutput(
        lecture_date="2026-10-11",
        events=[
            RevisionEvent(
                topic="Banker's Algorithm",
                date="2026-10-12",
                priority="high",
                confusion_score=0.82,
            )
        ],
    )
    assert sched.events[0].priority == "high"


def test_ask_response_schema_validation():
    """AskResponse and AskCitation populate both PRD and frontend alias fields."""
    resp = AskResponse(
        answer="Mutual exclusion only applies to non-shareable resources.",
        citations=[
            AskCitation(
                lecture_id="lec-1",
                lecture_title="OS Deadlocks",
                chunk_text="Read-only files are shareable resources.",
                start_ts=223.5,
                end_ts=248.0,
                similarity=0.91,
            )
        ],
    )
    cit = resp.citations[0]
    assert cit.text == "Read-only files are shareable resources."
    assert cit.timestamp == 223.5


@pytest.mark.asyncio
async def test_agent_invalid_json_triggers_single_retry():
    """
    When an agent receives invalid schema output on the first call, it must retry once
    with the validation error appended to the prompt, and succeed if the retry returns valid data.
    """
    agent = ConfusionDetectorAgent()
    chunks = [{"payload": {"chunk_index": 0, "text": "Sample chunk", "confusion_score": 0.8, "reasons": []}}]

    invalid_first_response = {"topics": "not_a_list_of_topics", "overall_score": 2.5}
    valid_second_response = {
        "topics": [
            {
                "name": "Recovered Topic",
                "confusion_score": 0.8,
                "reasons": ["Student question"],
                "chunk_indices": [0],
                "summary": "Recovered on retry",
            }
        ],
        "overall_score": 0.8,
    }

    mock_call = AsyncMock(side_effect=[invalid_first_response, valid_second_response])
    with patch("app.agents.confusion_detector.call_agent", mock_call):
        result = await agent.run(lecture_id="lec-retry-test", chunks=chunks)

    assert mock_call.call_count == 2
    # Verify the second call's prompt includes the validation error from the first attempt
    second_call_kwargs = mock_call.call_args_list[1].kwargs
    assert "Previous error:" in second_call_kwargs["prompt"]
    assert result.topics[0].name == "Recovered Topic"


@pytest.mark.asyncio
async def test_content_agent_retry_on_invalid_schema():
    """ContentAgent retries once when notes or quiz schema validation fails."""
    agent = ContentAgent()
    chunks = [{"payload": {"chunk_index": 0, "text": "Banker's algorithm safety check.", "confusion_score": 0.75}}]
    topics = [Topic(name="Banker's Algorithm", confusion_score=0.75, reasons=["Question"], chunk_indices=[0])]

    bad_notes = {"title": "Missing sections field"}
    good_notes = {
        "title": "Notes: OS",
        "summary": "Summary",
        "sections": [
            {
                "topic": "Banker's Algorithm",
                "content_markdown": "Details",
                "is_flagged": True,
                "explained_simply": "Simple explanation",
            }
        ],
    }
    good_quiz = {
        "title": "Quiz: OS",
        "questions": [
            {
                "question": "What does Banker's algorithm verify?",
                "options": ["Safe state", "Disk speed", "Cache size", "Clock rate"],
                "correct_index": 0,
                "explanation": "Checks safe state.",
                "source_chunk_index": 0,
                "source_text_snippet": "Banker's algorithm safety check.",
            }
        ],
    }

    mock_call = AsyncMock(side_effect=[bad_notes, good_notes, good_quiz])
    with patch("app.agents.content_agent.call_agent", mock_call):
        notes_out, quiz_out, _ = await agent.run(
            lecture_id="lec-content-retry",
            user_id="u1",
            lecture_title="OS Lecture",
            chunks=chunks,
            topics=topics,
        )

    assert mock_call.call_count == 3
    assert "Fix format:" in mock_call.call_args_list[1].kwargs["prompt"]
    assert notes_out.sections[0].explained_simply == "Simple explanation"
    assert len(quiz_out.questions) == 1
