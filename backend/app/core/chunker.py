"""Transcript segment chunking into time-windowed chunks."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.config import get_settings


class Segment(BaseModel):
    """Internal model for an individual transcript segment."""
    id: str
    text: str
    speaker: str = "lecturer"
    start: float = 0.0
    end: float = 0.0
    is_user: bool = False
    session_id: str | None = None


class Chunk(BaseModel):
    """Internal representation of a merged time-windowed chunk."""
    chunk_index: int
    texts: str
    speaker: str
    start_ts: float
    end_ts: float
    segment_ids: list[str] = Field(default_factory=list)


def chunk_segments(
    segments: list[Segment | dict[str, Any]],
    chunk_seconds: int | None = None,
    starting_index: int = 0,
) -> list[Chunk]:
    """
    Chunk transcript segments into time-windowed chunks.
    Merge small segments into the current chunk until the time window (default 45s) is filled.
    """
    if not segments:
        return []

    if chunk_seconds is None:
        chunk_seconds = get_settings().CHUNK_SECONDS

    # Convert dicts to Segment objects if needed
    parsed_segments: list[Segment] = []
    for s in segments:
        if isinstance(s, dict):
            parsed_segments.append(Segment(**s))
        else:
            parsed_segments.append(s)

    # Sort segments by start time
    parsed_segments.sort(key=lambda s: s.start)

    chunks: list[Chunk] = []
    current_segments: list[Segment] = []
    current_chunk_index = starting_index

    for seg in parsed_segments:
        if not current_segments:
            current_segments.append(seg)
            continue

        chunk_start = current_segments[0].start
        potential_duration = seg.end - chunk_start

        # If adding this segment exceeds chunk_seconds, finalize current chunk
        if potential_duration > chunk_seconds:
            # Finalize current chunk
            joined_text = " ".join(s.text.strip() for s in current_segments if s.text.strip())
            # Main speaker is student/user if any user spoke, else first speaker
            speakers = [s.speaker for s in current_segments]
            primary_speaker = "student" if any(s.is_user or s.speaker == "student" for s in current_segments) else speakers[0]

            chunks.append(
                Chunk(
                    chunk_index=current_chunk_index,
                    texts=joined_text,
                    speaker=primary_speaker,
                    start_ts=current_segments[0].start,
                    end_ts=current_segments[-1].end,
                    segment_ids=[s.id for s in current_segments],
                )
            )
            current_chunk_index += 1
            current_segments = [seg]
        else:
            current_segments.append(seg)

    # Add remaining segments as the last chunk
    if current_segments:
        joined_text = " ".join(s.text.strip() for s in current_segments if s.text.strip())
        speakers = [s.speaker for s in current_segments]
        primary_speaker = "student" if any(s.is_user or s.speaker == "student" for s in current_segments) else speakers[0]

        chunks.append(
            Chunk(
                chunk_index=current_chunk_index,
                texts=joined_text,
                speaker=primary_speaker,
                start_ts=current_segments[0].start,
                end_ts=current_segments[-1].end,
                segment_ids=[s.id for s in current_segments],
            )
        )

    return chunks
