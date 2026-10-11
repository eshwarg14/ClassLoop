"""Privacy API router for memory inspection, visibility toggle, and forgetting lectures."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.db.repo import delete_lecture, get_lecture, list_lectures
from app.deps import get_current_user_id, get_db
from app.logging import get_logger

logger = get_logger("classloop.api.privacy")

router = APIRouter(prefix="", tags=["Privacy"])


class VisibilityUpdateRequest(BaseModel):
    visibility: Literal["private", "shared", "class", "ephemeral"]
    expires_at: str | None = None


class BulkDeleteRequest(BaseModel):
    ids: list[str]


class ForgetAllRequest(BaseModel):
    confirmation: str | None = "FORGET"


def _format_memory_point(p: dict[str, Any]) -> dict[str, Any]:
    payload = p.get("payload", {})
    text = payload.get("text") or payload.get("texts") or ""
    topic = payload.get("topic") or "General"
    chunk_idx = payload.get("chunk_index", 0)
    return {
        "id": p["id"],
        "vector_id": p["id"],
        "lecture_id": payload.get("lecture_id"),
        "source_title": payload.get("lecture_title") or f"{topic} (Chunk #{chunk_idx})",
        "chunk_index": chunk_idx,
        "speaker": payload.get("speaker"),
        "text": text,
        "content": text,
        "topic": topic,
        "confusion_score": payload.get("confusion_score"),
        "visibility": payload.get("visibility", "private"),
        "created_at": payload.get("created_at") or datetime.now(UTC).isoformat(),
        "expires_at": payload.get("expires_at"),
    }


@router.get("/memories", status_code=status.HTTP_200_OK)
@router.get("/privacy/memories", status_code=status.HTTP_200_OK)
async def list_memories(
    user_id: str = Depends(get_current_user_id),
    limit: int = Query(50, ge=1, le=100),
):
    """List stored memories (Qdrant points) with visibility settings."""
    qdrant = get_qdrant_store_adapter()
    points = qdrant.list_user_points(user_id=user_id, limit=limit)
    return [_format_memory_point(p) for p in points]


@router.patch("/memories/{point_id}/visibility", status_code=status.HTTP_200_OK)
@router.put("/memories/{point_id}/visibility", status_code=status.HTTP_200_OK)
@router.patch("/privacy/memories/{point_id}/visibility", status_code=status.HTTP_200_OK)
@router.put("/privacy/memories/{point_id}/visibility", status_code=status.HTTP_200_OK)
async def update_memory_visibility(
    point_id: str,
    body: VisibilityUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Change visibility mode for a memory point (private / shared / class / ephemeral)."""
    qdrant = get_qdrant_store_adapter()
    success = qdrant.update_point_visibility(
        point_id=point_id,
        visibility=body.visibility,
        expires_at=body.expires_at,
    )
    return {
        "id": point_id,
        "visibility": body.visibility,
        "updated": success,
    }


@router.delete("/memories/{point_id}", status_code=status.HTTP_200_OK)
@router.delete("/privacy/memories/{point_id}", status_code=status.HTTP_200_OK)
async def delete_single_memory(
    point_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Delete a single memory point from Qdrant."""
    qdrant = get_qdrant_store_adapter()
    qdrant.delete_point(point_id=point_id)
    return {"success": True, "id": point_id, "deleted": True}


@router.post("/memories/bulk-delete", status_code=status.HTTP_200_OK)
@router.post("/privacy/memories/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_memories(
    body: BulkDeleteRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Bulk delete memory points from Qdrant."""
    qdrant = get_qdrant_store_adapter()
    for pid in body.ids:
        qdrant.delete_point(point_id=pid)
    return {"success": True, "deleted_count": len(body.ids)}


@router.post("/memories/forget-all", status_code=status.HTTP_200_OK)
@router.post("/privacy/forget-all", status_code=status.HTTP_200_OK)
@router.post("/forget-all", status_code=status.HTTP_200_OK)
async def forget_all_user_data(
    body: ForgetAllRequest | None = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete all Qdrant vectors and DB lectures for the user."""
    qdrant = get_qdrant_store_adapter()
    qdrant.delete_user_points(user_id=user_id)
    lectures = await list_lectures(db, user_id=user_id, limit=500)
    for lec in lectures:
        await delete_lecture(db, lecture_id=lec.id)
    return {"success": True, "deleted": True, "user_id": user_id}


@router.delete("/lectures/{lecture_id}/forget", status_code=status.HTTP_200_OK)
async def forget_lecture(
    lecture_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove Qdrant points AND DB rows for a lecture (Right to be forgotten)."""
    lecture = await get_lecture(db, lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if lecture.user_id != user_id and user_id != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    # 1. Delete Qdrant vectors
    qdrant = get_qdrant_store_adapter()
    qdrant.delete_lecture_points(lecture_id=lecture_id)

    # 2. Delete database rows (cascade deletes outputs, jobs, traces)
    deleted = await delete_lecture(db, lecture_id=lecture_id)

    logger.info("lecture_forgotten_and_deleted", lecture_id=lecture_id, user_id=user_id)
    return {
        "lecture_id": lecture_id,
        "deleted": deleted,
        "success": True,
        "message": "Lecture vectors and database records permanently removed",
    }


@router.post("/cleanup/ephemeral", status_code=status.HTTP_200_OK)
async def cleanup_expired_ephemeral():
    """Trigger cleanup of expired ephemeral points."""
    qdrant = get_qdrant_store_adapter()
    count = qdrant.delete_expired_ephemeral()
    return {"cleaned_points_count": count}
