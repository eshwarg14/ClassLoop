"""Webhook API router handling wearable audio transcripts and real-time chunking."""

from __future__ import annotations

import asyncio
import re
from datetime import UTC, datetime
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Request,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters import omi_adapter
from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.config import get_settings
from app.core.chunker import chunk_segments
from app.core.confusion import is_manual_confusion_flag, score_confusion
from app.core.embedder import embed_texts
from app.core.events import get_event_bus
from app.core.jobs import get_job_runner
from app.db.repo import create_lecture, list_lectures, update_lecture_status
from app.db.session import get_session_maker
from app.deps import get_db
from app.logging import get_logger

logger = get_logger("classloop.api.webhook")

router = APIRouter(prefix="/webhook", tags=["Webhook"])

END_LECTURE_PATTERNS = [
    r"\bend\s+(the\s+)?lecture\b",
    r"\bstop\s+(the\s+)?lecture\b",
    r"\bthat\s+concludes\s+today'?s\s+lecture\b",
    r"\bthat\s+wraps\s+up\s+today'?s\s+lecture\b",
    r"\bclass\s+is\s+dismissed\b",
]


def is_end_lecture_command(text: str) -> bool:
    """Check if text contains a voice command to end the lecture."""
    text_lower = text.lower()
    return any(re.search(pat, text_lower) for pat in END_LECTURE_PATTERNS)


# In-memory session buffers
_session_buffers: dict[str, dict[str, Any]] = {}
_buffer_lock = asyncio.Lock()


def get_session_buffers() -> dict[str, dict[str, Any]]:
    return _session_buffers


async def flush_and_end_session(session_id: str, lecture_id: str, user_id: str) -> None:
    """Idempotently flush remaining buffered segments, mark lecture processing, and submit job."""
    buf = _session_buffers.get(session_id)
    if buf:
        if buf.get("ended"):
            return
        buf["ended"] = True
        rem_segments = buf.get("segments", [])
        if rem_segments:
            start_idx = len(buf["chunks"])
            final_chunks = chunk_segments(rem_segments, starting_index=start_idx)
            qdrant = get_qdrant_store_adapter()
            for fc in final_chunks:
                vec = embed_texts([fc.texts])[0]
                sc, reas = score_confusion(
                    fc,
                    prev_chunk=buf.get("prev_chunk"),
                    prev_embedding=buf.get("prev_embedding"),
                    curr_embedding=vec,
                )
                buf["prev_chunk"] = fc
                buf["prev_embedding"] = vec
                buf["chunks"].append(fc)
                qdrant.upsert_chunks(
                    lecture_id=lecture_id,
                    user_id=user_id,
                    chunks_with_embeddings=[{
                        "chunk_index": fc.chunk_index,
                        "start_ts": fc.start_ts,
                        "end_ts": fc.end_ts,
                        "speaker": fc.speaker,
                        "text": fc.texts,
                        "embedding": vec,
                        "confusion_score": sc,
                        "reasons": reas,
                    }],
                )
            buf["segments"] = []

    session_maker = get_session_maker()
    async with session_maker() as session:
        await update_lecture_status(session, lecture_id=lecture_id, status="processing")

    event_bus = get_event_bus()
    await event_bus.emit(
        lecture_id=lecture_id,
        event_type="lecture_ended",
        data={"lecture_id": lecture_id, "status": "processing"},
    )

    runner = get_job_runner()
    await runner.submit_job(lecture_id=lecture_id)


async def check_silence_timeouts() -> int:
    """Check active session buffers for silence timeout and auto-end lectures."""
    now_ts = datetime.now(UTC).timestamp()
    timeout_sec = get_settings().SILENCE_TIMEOUT_SECONDS
    ended_count = 0

    for session_id, buf in list(_session_buffers.items()):
        if buf.get("ended"):
            continue
        last_ts = buf.get("last_activity_ts", now_ts)
        if (now_ts - last_ts) > timeout_sec:
            lecture_id = buf.get("lecture_id")
            user_id = buf.get("user_id", "u1")
            if lecture_id:
                logger.info("silence_timeout_triggered", session_id=session_id, lecture_id=lecture_id)
                await flush_and_end_session(session_id=session_id, lecture_id=lecture_id, user_id=user_id)
                ended_count += 1

    return ended_count


async def _process_buffered_segments(session_id: str, lecture_id: str, user_id: str) -> None:
    """Background worker processing segment chunking, embedding, and scoring."""
    buffer = _session_buffers.get(session_id)
    if not buffer:
        return

    chunk_seconds = get_settings().CHUNK_SECONDS
    qdrant = get_qdrant_store_adapter()
    event_bus = get_event_bus()

    while True:
        unprocessed_segments = buffer["segments"]
        if not unprocessed_segments:
            break

        earliest_start = unprocessed_segments[0].start
        latest_end = unprocessed_segments[-1].end

        # If span is greater than chunk_seconds, create chunk(s)
        if (latest_end - earliest_start) >= chunk_seconds or len(unprocessed_segments) >= 10:
            starting_idx = len(buffer["chunks"])
            new_chunks = chunk_segments(unprocessed_segments, chunk_seconds=chunk_seconds, starting_index=starting_idx)

            if not new_chunks:
                break

            finalized_chunk = new_chunks[0]
            # Keep any segments that were not included in finalized_chunk
            included_ids = set(finalized_chunk.segment_ids)
            buffer["segments"] = [s for s in unprocessed_segments if s.id not in included_ids]
            buffer["chunks"].append(finalized_chunk)

            # Embed finalized chunk
            texts_to_embed = [finalized_chunk.texts]
            embeddings = embed_texts(texts_to_embed)
            curr_vec = embeddings[0] if embeddings else []

            # Score confusion
            score, reasons = score_confusion(
                chunk=finalized_chunk,
                prev_chunk=buffer.get("prev_chunk"),
                prev_embedding=buffer.get("prev_embedding"),
                curr_embedding=curr_vec,
            )

            buffer["prev_chunk"] = finalized_chunk
            buffer["prev_embedding"] = curr_vec

            # Upsert chunk to Qdrant
            qdrant.upsert_chunks(
                lecture_id=lecture_id,
                user_id=user_id,
                chunks_with_embeddings=[{
                    "chunk_index": finalized_chunk.chunk_index,
                    "start_ts": finalized_chunk.start_ts,
                    "end_ts": finalized_chunk.end_ts,
                    "speaker": finalized_chunk.speaker,
                    "text": finalized_chunk.texts,
                    "embedding": curr_vec,
                    "confusion_score": score,
                    "reasons": reasons,
                }],
            )

            # Emit chunk_scored SSE event
            await event_bus.emit(
                lecture_id=lecture_id,
                event_type="chunk_scored",
                data={
                    "chunk_index": finalized_chunk.chunk_index,
                    "start_ts": finalized_chunk.start_ts,
                    "end_ts": finalized_chunk.end_ts,
                    "speaker": finalized_chunk.speaker,
                    "text": finalized_chunk.texts,
                    "confusion_score": score,
                    "reasons": reasons,
                },
            )
        else:
            break


@router.post("/omi", status_code=status.HTTP_200_OK)
async def receive_omi_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_omi_signature: str | None = Header(None, alias="X-Omi-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest transcripts from wearable Omi webhook.
    Returns 200 fast (< 200ms) without blocking on LLM agents.
    """
    raw_bytes = await request.body()
    settings = get_settings()

    # 1. Verify webhook signature if secret configured
    if settings.OMI_WEBHOOK_SECRET:
        if not omi_adapter.verify_webhook_signature(raw_bytes, x_omi_signature, settings.OMI_WEBHOOK_SECRET):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body") from exc

    # 2. Parse segments
    parsed_segments = omi_adapter.parse_webhook_payload(payload)
    if not parsed_segments:
        return {"status": "ok", "message": "No text segments parsed", "segments_count": 0}

    session_id = payload.get("session_id") or parsed_segments[0].session_id or "default_session"
    user_id = payload.get("user_id") or "u1"

    # 3. Deduplicate incoming segments
    seen_ids = omi_adapter.get_session_seen_ids(session_id)
    new_segments = omi_adapter.deduplicate_segments(parsed_segments, seen_ids)
    if not new_segments:
        return {"status": "ok", "message": "Duplicate segments skipped", "segments_count": 0}

    # 4. Lookup or create Lecture in DB
    async with _buffer_lock:
        if session_id not in _session_buffers or _session_buffers[session_id].get("ended"):
            # Check DB for active lecture with this session_id
            lectures = await list_lectures(db, user_id=user_id, limit=5)
            active_lec = next((lec for lec in lectures if lec.session_id == session_id and lec.status == "live"), None)

            if not active_lec:
                title = payload.get("lecture_title") or f"Lecture: {datetime.now(UTC).strftime('%b %d, %H:%M')}"
                active_lec = await create_lecture(db, user_id=user_id, title=title, session_id=session_id)

            _session_buffers[session_id] = {
                "lecture_id": active_lec.id,
                "user_id": user_id,
                "segments": [],
                "chunks": [],
                "prev_embedding": None,
                "prev_chunk": None,
                "last_activity_ts": datetime.now(UTC).timestamp(),
                "ended": False,
            }

        buf = _session_buffers[session_id]
        lecture_id = buf["lecture_id"]
        buf["segments"].extend(new_segments)
        buf["last_activity_ts"] = datetime.now(UTC).timestamp()

    # 5. Emit segment SSE event for real-time frontend streaming
    event_bus = get_event_bus()
    end_command_detected = False
    for seg in new_segments:
        await event_bus.emit(
            lecture_id=lecture_id,
            event_type="segment",
            data={
                "id": seg.id,
                "text": seg.text,
                "speaker": seg.speaker,
                "start": seg.start,
                "end": seg.end,
                "is_user": seg.is_user,
            },
        )

        # Check for voice command manual flag
        if is_manual_confusion_flag(seg.text):
            await event_bus.emit(
                lecture_id=lecture_id,
                event_type="flag_added",
                data={
                    "segment_id": seg.id,
                    "text": seg.text,
                    "source": "voice_command",
                },
            )

        if is_end_lecture_command(seg.text):
            end_command_detected = True

    # 6. Schedule background chunking, embedding, scoring
    background_tasks.add_task(_process_buffered_segments, session_id, lecture_id, user_id)

    if end_command_detected:
        background_tasks.add_task(flush_and_end_session, session_id, lecture_id, user_id)

    return {
        "status": "ok",
        "lecture_id": lecture_id,
        "processed_segments": len(new_segments),
        "end_triggered": end_command_detected,
    }
