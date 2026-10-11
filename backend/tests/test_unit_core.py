"""Unit tests for core ClassLoop modules: chunker, confusion scorer, scheduler rules, and .ics export."""

from datetime import date

from app.core.chunker import Chunk, Segment, chunk_segments
from app.core.confusion import is_manual_confusion_flag, score_confusion
from app.core.ics import generate_revision_ics
from app.core.scheduler_rules import calculate_revision_schedule

# ==============================================================================
# 1. Chunker Tests
# ==============================================================================


def test_chunker_empty_input():
    """Empty segment list should return empty chunk list."""
    assert chunk_segments([]) == []


def test_chunker_window_splitting():
    """Segments exceeding chunk_seconds window should split into multiple sequential chunks."""
    segments = [
        Segment(id="s1", text="Intro to deadlocks.", speaker="lecturer", start=0.0, end=20.0),
        Segment(id="s2", text="Mutual exclusion explained.", speaker="lecturer", start=21.0, end=42.0),
        Segment(id="s3", text="Hold and wait condition.", speaker="lecturer", start=46.0, end=70.0),
        Segment(id="s4", text="No preemption details.", speaker="lecturer", start=72.0, end=95.0),
    ]
    chunks = chunk_segments(segments, chunk_seconds=45, starting_index=0)
    assert len(chunks) == 3
    assert chunks[0].chunk_index == 0
    assert chunks[0].segment_ids == ["s1", "s2"]
    assert chunks[0].start_ts == 0.0
    assert chunks[0].end_ts == 42.0
    assert "Intro to deadlocks." in chunks[0].texts
    assert "Mutual exclusion explained." in chunks[0].texts

    assert chunks[1].chunk_index == 1
    assert chunks[1].segment_ids == ["s3"]
    assert chunks[2].chunk_index == 2
    assert chunks[2].segment_ids == ["s4"]


def test_chunker_speaker_resolution_and_dict_input():
    """If any segment in the window is from a student or has is_user=True, speaker resolves to 'student'."""
    raw_dicts = [
        {"id": "s1", "text": "Here is the matrix.", "speaker": "lecturer", "start": 0.0, "end": 10.0, "is_user": False},
        {"id": "s2", "text": "Wait, why is it singular?", "speaker": "lecturer", "start": 11.0, "end": 20.0, "is_user": True},
    ]
    chunks = chunk_segments(raw_dicts, chunk_seconds=45, starting_index=5)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 5
    assert chunks[0].speaker == "student"


# ==============================================================================
# 2. Confusion Scorer Tests
# ==============================================================================


def test_confusion_manual_flag_override():
    """Manual override or voice trigger phrase should immediately return 1.0."""
    c1 = Chunk(
        chunk_index=0,
        texts="Normal lecture text without any triggers.",
        speaker="lecturer",
        start_ts=0.0,
        end_ts=30.0,
    )
    score, reasons = score_confusion(c1, manual_override=True)
    assert score == 1.0
    assert any("Manual" in r for r in reasons)

    c2 = Chunk(
        chunk_index=1,
        texts="Let me mark this as confusing because students mix up safe and unsafe states.",
        speaker="lecturer",
        start_ts=30.0,
        end_ts=60.0,
    )
    assert is_manual_confusion_flag(c2.texts) is True
    score2, reasons2 = score_confusion(c2)
    assert score2 == 1.0
    assert any("Manual" in r for r in reasons2)


def test_confusion_student_question():
    """Student speaker or question patterns should trigger student_question signal."""
    chunk = Chunk(
        chunk_index=0,
        texts="Wait Professor, how does the Banker's algorithm handle dynamic resource requests?",
        speaker="student",
        start_ts=0.0,
        end_ts=10.0,
    )
    score, reasons = score_confusion(chunk)
    assert score >= 0.35
    assert any("question" in r.lower() for r in reasons)


def test_confusion_lecturer_rephrase_with_embedding_similarity():
    """Lecturer rephrase phrase combined with high cosine similarity between embeddings."""
    prev = Chunk(
        chunk_index=0,
        texts="A cycle in a wait-for graph indicates deadlock in single-instance systems.",
        speaker="lecturer",
        start_ts=0.0,
        end_ts=20.0,
    )
    curr = Chunk(
        chunk_index=1,
        texts="In other words, let me rephrase that: a cycle is necessary and sufficient here.",
        speaker="lecturer",
        start_ts=21.0,
        end_ts=40.0,
    )
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [0.95, 0.05, 0.0]
    score, reasons = score_confusion(curr, prev_chunk=prev, prev_embedding=vec_a, curr_embedding=vec_b)
    assert score >= 0.2
    assert any("rephrase" in r.lower() for r in reasons)


def test_confusion_checkin_phrase():
    """Check-in phrase should add check_in_phrase weight."""
    chunk = Chunk(
        chunk_index=0,
        texts="We order all locks globally to avoid circular wait. Does that make sense to everyone?",
        speaker="lecturer",
        start_ts=0.0,
        end_ts=15.0,
    )
    score, reasons = score_confusion(chunk)
    assert score >= 0.15
    assert any("check-in" in r.lower() for r in reasons)


def test_confusion_pace_drop_and_custom_weights():
    """Slow speech pace (< 1.2 wps with > 5 words) and custom weights should be respected."""
    slow_chunk = Chunk(
        chunk_index=1,
        texts="One two three four five six seven eight.",
        speaker="lecturer",
        start_ts=10.0,
        end_ts=30.0,  # 8 words in 20 seconds = 0.4 wps
    )
    score, reasons = score_confusion(slow_chunk, weights={"pace_drop": 0.45})
    assert score == 0.45
    assert any("pace drop" in r.lower() for r in reasons)


# ==============================================================================
# 3. Scheduler Rules Tests
# ==============================================================================


def test_scheduler_rules_tiers():
    """
    Verify PRD revision schedule intervals:
    - score >= 0.7 -> days 1, 2, 5, 10 (high)
    - 0.4 <= score < 0.7 -> days 1, 3, 7 (medium)
    - score < 0.4 -> day 7 (low)
    """
    base = date(2026, 10, 1)
    topics = [
        {"name": "High Confusion Topic", "confusion_score": 0.85},
        {"name": "Medium Confusion Topic", "confusion_score": 0.55},
        {"name": "Low Confusion Topic", "confusion_score": 0.20},
    ]

    events = calculate_revision_schedule(topics, lecture_date=base)
    high_events = [e for e in events if e.topic == "High Confusion Topic"]
    med_events = [e for e in events if e.topic == "Medium Confusion Topic"]
    low_events = [e for e in events if e.topic == "Low Confusion Topic"]

    assert [e.day_offset for e in high_events] == [1, 2, 5, 10]
    assert all(e.priority == "high" for e in high_events)
    assert [e.date for e in high_events] == ["2026-10-02", "2026-10-03", "2026-10-06", "2026-10-11"]

    assert [e.day_offset for e in med_events] == [1, 3, 7]
    assert all(e.priority == "medium" for e in med_events)

    assert [e.day_offset for e in low_events] == [7]
    assert all(e.priority == "low" for e in low_events)


# ==============================================================================
# 4. .ics Calendar Export Tests
# ==============================================================================


def test_ics_calendar_generation():
    """Verify valid VCALENDAR output, matching VEVENT count, and summary/description fields."""
    base = date(2026, 10, 1)
    topics = [
        {"name": "Banker's Algorithm", "confusion_score": 0.80},
        {"name": "Mutex Basics", "confusion_score": 0.25},
    ]
    schedule_events = calculate_revision_schedule(topics, lecture_date=base)
    assert len(schedule_events) == 5  # 4 high + 1 low

    ics_bytes = generate_revision_ics(schedule_events, lecture_title="CS 301 Operating Systems")
    assert isinstance(ics_bytes, bytes)
    ics_text = ics_bytes.decode("utf-8")

    assert "BEGIN:VCALENDAR" in ics_text
    assert "END:VCALENDAR" in ics_text
    assert ics_text.count("BEGIN:VEVENT") == 5
    assert "Banker's Algorithm" in ics_text
    assert "Mutex Basics" in ics_text
    assert "DESCRIPTION:" in ics_text
    assert "SUMMARY:Review:" in ics_text
