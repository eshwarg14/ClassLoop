"""Lectures API router for lecture management, outputs, traces, and triggers."""

from __future__ import annotations

import base64
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.api.webhook import get_session_buffers
from app.core.chunker import chunk_segments
from app.core.confusion import score_confusion
from app.core.embedder import embed_texts
from app.core.events import get_event_bus
from app.core.jobs import get_job_runner
from app.db.repo import (
    create_lecture,
    delete_lecture,
    get_job_by_lecture_id,
    get_lecture,
    get_output,
    get_traces_for_lecture,
    list_lectures,
    update_lecture_status,
)
from app.deps import get_current_user_id, get_db
from app.logging import get_logger

logger = get_logger("classloop.api.lectures")

router = APIRouter(prefix="/lectures", tags=["Lectures"])
demo_router = APIRouter(prefix="/demo", tags=["Demo"])


class CreateLectureRequest(BaseModel):
    title: str = "New Lecture"
    subject: str | None = None


class FlagRequest(BaseModel):
    chunk_index: int | None = None
    chunk_id: str | None = None
    reason: str | None = "Manual flag"


def _format_chunks(lecture_id: str, chunk_points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chunks = []
    for cp in chunk_points:
        payload = cp.get("payload", {})
        s_ts = float(payload.get("start_ts", 0.0))
        e_ts = float(payload.get("end_ts", 0.0))
        c_score = float(payload.get("confusion_score", 0.0))
        reasons = payload.get("reasons", [])
        is_flagged = bool(payload.get("is_flagged") or c_score >= 0.7 or "Manual" in reasons)
        chunks.append({
            "id": cp["id"],
            "lecture_id": lecture_id,
            "chunk_index": payload.get("chunk_index", 0),
            "start_ts": s_ts,
            "end_ts": e_ts,
            "start_time": s_ts,
            "end_time": e_ts,
            "speaker": payload.get("speaker", "lecturer"),
            "text": payload.get("text") or payload.get("texts", ""),
            "confusion_score": c_score,
            "reasons": reasons,
            "visibility": payload.get("visibility", "private"),
            "is_flagged": is_flagged,
        })
    return chunks


def _compute_lecture_metrics(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [float(c.get("confusion_score", 0.0)) for c in chunks]
    mean_confusion = round(sum(scores) / len(scores), 2) if scores else 0.0
    peak_confusion = round(max(scores), 2) if scores else 0.0
    flagged_count = sum(
        1 for c in chunks
        if c.get("is_flagged") or float(c.get("confusion_score", 0.0)) >= 0.7 or "Manual" in c.get("reasons", [])
    )
    visibility = chunks[0].get("visibility", "private") if chunks else "private"
    duration = int(max((float(c.get("end_ts", 0.0)) for c in chunks), default=0.0))
    return {
        "mean_confusion": mean_confusion,
        "peak_confusion": peak_confusion,
        "flagged_count": flagged_count,
        "visibility": visibility,
        "confusion_trend": scores,
        "duration": duration,
    }


@router.get("", status_code=status.HTTP_200_OK)
async def get_lectures(
    user_id: str = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List lectures for user ordered by creation date descending."""
    lectures = await list_lectures(db, user_id=user_id, limit=limit, offset=offset)
    qdrant = get_qdrant_store_adapter()
    results = []
    for lec in lectures:
        chunk_points = qdrant.get_lecture_chunks(lecture_id=lec.id, user_id=user_id)
        chunks = _format_chunks(lec.id, chunk_points)
        metrics = _compute_lecture_metrics(chunks)
        results.append({
            "id": lec.id,
            "title": lec.title,
            "status": lec.status,
            "session_id": lec.session_id,
            "started_at": lec.started_at.isoformat() if lec.started_at else None,
            "ended_at": lec.ended_at.isoformat() if lec.ended_at else None,
            "created_at": lec.created_at.isoformat(),
            **metrics,
            "heatmap": chunks,
            "chunks": chunks,
        })
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_new_lecture(
    body: CreateLectureRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new lecture."""
    lec = await create_lecture(db, user_id=user_id, title=body.title)
    return {
        "id": lec.id,
        "title": lec.title,
        "status": lec.status,
        "created_at": lec.created_at.isoformat(),
        "mean_confusion": 0.0,
        "peak_confusion": 0.0,
        "flagged_count": 0,
        "visibility": "private",
        "heatmap": [],
        "chunks": [],
    }


@router.get("/{lecture_id}", status_code=status.HTTP_200_OK)
async def get_lecture_detail(
    lecture_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Lecture detail with heatmap data (all chunks with scores)."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    qdrant = get_qdrant_store_adapter()
    chunk_points = qdrant.get_lecture_chunks(lecture_id=lecture_id, user_id=user_id)
    chunks = _format_chunks(lecture_id, chunk_points)
    metrics = _compute_lecture_metrics(chunks)

    job = await get_job_by_lecture_id(db, lecture_id)

    return {
        "id": lecture.id,
        "title": lecture.title,
        "status": lecture.status,
        "session_id": lecture.session_id,
        "started_at": lecture.started_at.isoformat() if lecture.started_at else None,
        "ended_at": lecture.ended_at.isoformat() if lecture.ended_at else None,
        "created_at": lecture.created_at.isoformat(),
        **metrics,
        "job": {
            "id": job.id,
            "status": job.status,
            "attempts": job.attempts,
            "error": job.error,
        } if job else None,
        "heatmap": chunks,
        "chunks": chunks,
    }


@router.get("/{lecture_id}/transcript", status_code=status.HTTP_200_OK)
async def get_lecture_transcript(
    lecture_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get transcript chunks for lecture with both start_ts/end_ts and start_time/end_time."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    qdrant = get_qdrant_store_adapter()
    chunk_points = qdrant.get_lecture_chunks(lecture_id=lecture_id, user_id=user_id)
    return _format_chunks(lecture_id, chunk_points)


@router.get("/{lecture_id}/notes", status_code=status.HTTP_200_OK)
async def get_lecture_notes(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get generated notes for lecture."""
    output = await get_output(db, lecture_id, "notes")
    if not output:
        raise HTTPException(status_code=404, detail="Notes not yet generated for this lecture")
    content = dict(output.content) if isinstance(output.content, dict) else {"sections": []}
    title = content.get("title", "Lecture Study Notes")
    summary = content.get("summary", "")
    sections = content.get("sections", [])

    # Build combined markdown for frontend NotesView while preserving sections list
    md_parts = [f"# {title}\n"]
    if summary:
        md_parts.append(f"## Executive Summary\n{summary}\n")
    enriched_sections = []
    for idx, sec in enumerate(sections):
        sec_copy = dict(sec)
        sec_topic = sec_copy.get("topic") or sec_copy.get("title") or f"Section {idx + 1}"
        sec_md = sec_copy.get("content_markdown") or sec_copy.get("content") or ""
        explained = sec_copy.get("explained_simply") or sec_copy.get("simplified_explanation")
        sec_copy.setdefault("id", f"sec-{idx + 1}")
        sec_copy.setdefault("title", sec_topic)
        sec_copy.setdefault("content", sec_md)
        sec_copy.setdefault("simplified_explanation", explained)
        enriched_sections.append(sec_copy)

        md_parts.append(f"## {sec_topic}\n\n{sec_md}\n")
        if explained:
            md_parts.append(f"> **Explained simply**\n> {explained}\n")

    content["sections"] = enriched_sections
    content.setdefault("lecture_id", lecture_id)
    content.setdefault("created_at", output.created_at.isoformat())
    content.setdefault("markdown", "\n".join(md_parts))
    return content


@router.get("/{lecture_id}/quiz", status_code=status.HTTP_200_OK)
async def get_lecture_quiz(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get generated quiz for lecture."""
    output = await get_output(db, lecture_id, "quiz")
    if not output:
        raise HTTPException(status_code=404, detail="Quiz not yet generated for this lecture")
    content = dict(output.content) if isinstance(output.content, dict) else {"questions": []}
    questions = []
    for idx, q in enumerate(content.get("questions", [])):
        q_copy = dict(q)
        q_copy.setdefault("id", f"q{idx + 1}")
        src_idx = q_copy.get("source_chunk_index", 0)
        q_copy.setdefault("citation_chunk_id", f"chunk-{src_idx}")
        questions.append(q_copy)
    content["questions"] = questions
    content.setdefault("lecture_id", lecture_id)
    content.setdefault("created_at", output.created_at.isoformat())
    return content


@router.get("/{lecture_id}/schedule", status_code=status.HTTP_200_OK)
async def get_lecture_schedule(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get JSON revision schedule events for lecture."""
    output = await get_output(db, lecture_id, "schedule")
    if not output:
        raise HTTPException(status_code=404, detail="Schedule not yet generated for this lecture")

    lecture = await get_lecture(db, lecture_id)
    lecture_title = lecture.title if lecture else "Lecture Revision"

    content = output.content if isinstance(output.content, dict) else {}
    sched_data = content.get("schedule", content)
    raw_events = sched_data.get("events", []) if isinstance(sched_data, dict) else []
    base_date_str = sched_data.get("lecture_date") if isinstance(sched_data, dict) else None

    formatted_events = []
    for idx, ev in enumerate(raw_events):
        ev_date = ev.get("date") or datetime.now(UTC).date().isoformat()
        interval_day = 1
        if base_date_str:
            try:
                d0 = datetime.fromisoformat(base_date_str).date()
                d1 = datetime.fromisoformat(ev_date).date()
                interval_day = max(1, (d1 - d0).days)
            except Exception:
                interval_day = 1
        formatted_events.append({
            "id": f"rev-{idx + 1}",
            "lecture_id": lecture_id,
            "lecture_title": lecture_title,
            "topic": ev.get("topic", "General Revision"),
            "date": ev_date,
            "scheduled_date": ev_date,
            "interval_day": interval_day,
            "priority": ev.get("priority", "medium"),
            "confusion_score": float(ev.get("confusion_score", 0.0)),
            "status": "pending",
        })

    return formatted_events


@router.get("/{lecture_id}/schedule.ics")
async def download_lecture_ics(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Download .ics calendar file for lecture revision."""
    output = await get_output(db, lecture_id, "schedule")
    if not output:
        raise HTTPException(status_code=404, detail="Schedule not yet generated for this lecture")

    content = output.content
    ics_b64 = content.get("ics_base64")
    if not ics_b64:
        raise HTTPException(status_code=404, detail="Calendar file data missing")

    ics_bytes = base64.b64decode(ics_b64)
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=classloop_revision_{lecture_id[:8]}.ics"},
    )


@router.get("/{lecture_id}/related", status_code=status.HTTP_200_OK)
async def get_lecture_related(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get cross-lecture semantic links for lecture."""
    output = await get_output(db, lecture_id, "cross_links")
    if not output:
        return []
    return output.content if isinstance(output.content, list) else []


@router.get("/{lecture_id}/trace", status_code=status.HTTP_200_OK)
async def get_lecture_traces(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get agent execution traces for lecture."""
    traces = await get_traces_for_lecture(db, lecture_id)
    return [
        {
            "id": t.id,
            "agent_name": t.agent_name,
            "status": t.status,
            "latency_ms": t.latency_ms,
            "output": t.output,
            "error": t.error,
            "created_at": t.created_at.isoformat(),
        }
        for t in traces
    ]


@router.post("/{lecture_id}/end", status_code=status.HTTP_200_OK)
async def end_lecture(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Manual end trigger: updates lecture status, flushes remaining segments, submits job."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    # Flush any remaining buffer segments into final chunks
    buffers = get_session_buffers()
    for _s_id, buf in list(buffers.items()):
        if buf.get("lecture_id") == lecture_id:
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
                        user_id=lecture.user_id,
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

    # Mark lecture ended
    await update_lecture_status(db, lecture_id=lecture_id, status="processing")

    # Emit lecture_ended SSE event
    event_bus = get_event_bus()
    await event_bus.emit(
        lecture_id=lecture_id,
        event_type="lecture_ended",
        data={"lecture_id": lecture_id, "status": "processing"},
    )

    # Submit job to JobRunner
    runner = get_job_runner()
    await runner.submit_job(lecture_id=lecture_id)

    return {"status": "processing", "success": True, "lecture_id": lecture_id, "message": "Pipeline triggered"}


@router.post("/{lecture_id}/retry", status_code=status.HTTP_200_OK)
async def retry_lecture_job(
    lecture_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retry failed job for lecture."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    await update_lecture_status(db, lecture_id=lecture_id, status="processing")
    runner = get_job_runner()
    await runner.submit_job(lecture_id=lecture_id)

    return {"status": "retrying", "success": True, "lecture_id": lecture_id}


@router.post("/{lecture_id}/flag", status_code=status.HTTP_200_OK)
async def flag_lecture_chunk(
    lecture_id: str,
    body: FlagRequest | None = None,
    user_id: str = Depends(get_current_user_id),
):
    """Mark a chunk as confusing (updates Qdrant point to confusion_score=1.0 and adds 'Manual' reason)."""
    req = body or FlagRequest()
    qdrant = get_qdrant_store_adapter()
    updated_in_qdrant = qdrant.flag_chunk(
        lecture_id=lecture_id,
        user_id=user_id,
        chunk_index=req.chunk_index,
        chunk_id=req.chunk_id,
        reason=req.reason or "Manual",
    )

    event_bus = get_event_bus()
    await event_bus.emit(
        lecture_id=lecture_id,
        event_type="flag_added",
        data={
            "lecture_id": lecture_id,
            "chunk_index": req.chunk_index,
            "chunk_id": req.chunk_id,
            "reason": req.reason,
            "source": "manual_ui_button",
        },
    )
    return {
        "status": "flagged",
        "success": True,
        "updated_qdrant": updated_in_qdrant,
        "lecture_id": lecture_id,
    }


@router.delete("/{lecture_id}", status_code=status.HTTP_200_OK)
@router.delete("/{lecture_id}/forget", status_code=status.HTTP_200_OK)
async def delete_or_forget_lecture(
    lecture_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete lecture vectors from Qdrant and remove database rows."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lecture.user_id != user_id and user_id != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    qdrant = get_qdrant_store_adapter()
    qdrant.delete_lecture_points(lecture_id=lecture_id)
    deleted = await delete_lecture(db, lecture_id=lecture_id)

    return {
        "lecture_id": lecture_id,
        "deleted": deleted,
        "success": True,
        "message": "Lecture vectors and database records permanently removed",
    }


@demo_router.post("/start", status_code=status.HTTP_200_OK)
async def start_demo_session(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Load scripts/sample_lecture.json, ingest chunks into Qdrant, and trigger pipeline."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    sample_path = root_dir / "scripts" / "sample_lecture.json"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="scripts/sample_lecture.json not found")

    data = json.loads(sample_path.read_text(encoding="utf-8"))
    title = data.get("lecture_title", "Operating Systems: Deadlock Fundamentals")
    raw_segments = data.get("segments", [])

    lecture = await create_lecture(
        db,
        user_id=user_id,
        title=title,
        session_id=f"demo_{datetime.now(UTC).strftime('%H%M%S')}",
    )

    chunks = chunk_segments(raw_segments)
    qdrant = get_qdrant_store_adapter()
    prev_chunk = None
    prev_vec = None
    chunks_payload = []

    for c in chunks:
        vec = embed_texts([c.texts])[0]
        sc, reas = score_confusion(
            c,
            prev_chunk=prev_chunk,
            prev_embedding=prev_vec,
            curr_embedding=vec,
        )
        prev_chunk = c
        prev_vec = vec
        chunks_payload.append({
            "chunk_index": c.chunk_index,
            "start_ts": c.start_ts,
            "end_ts": c.end_ts,
            "speaker": c.speaker,
            "text": c.texts,
            "embedding": vec,
            "confusion_score": sc,
            "reasons": reas,
        })

    if chunks_payload:
        qdrant.upsert_chunks(
            lecture_id=lecture.id,
            user_id=user_id,
            chunks_with_embeddings=chunks_payload,
        )

    await update_lecture_status(db, lecture_id=lecture.id, status="processing")
    runner = get_job_runner()
    await runner.submit_job(lecture_id=lecture.id)

    return {"lecture_id": lecture.id, "status": "processing"}
