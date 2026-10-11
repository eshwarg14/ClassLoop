"""Grounded Q&A API router using vector semantic search over lecture chunks."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.adapters.lyzr_adapter import call_agent
from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.agents.schemas import AskCitation, AskResponse
from app.config import get_settings
from app.core.embedder import embed_text
from app.deps import get_current_user_id
from app.logging import get_logger

logger = get_logger("classloop.api.ask")

router = APIRouter(prefix="/ask", tags=["Ask"])


class AskRequest(BaseModel):
    query: str | None = Field(default=None, max_length=1000)
    question: str | None = Field(default=None, max_length=1000)
    lecture_id: str | None = None
    scope: Literal["lecture", "all", "active"] = "all"


@router.post("", response_model=AskResponse, status_code=status.HTTP_200_OK)
async def ask_question(
    body: AskRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Q&A grounded in Qdrant chunks.
    Always filters by user_id and visibility.
    """
    query_text = (body.query or body.question or "").strip()
    if not query_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'query' or 'question' must be provided",
        )

    settings = get_settings()
    qdrant = get_qdrant_store_adapter()

    # 1. Embed query
    query_vec = embed_text(query_text)

    # 2. Search relevant chunks in Qdrant
    target_lecture_id = body.lecture_id if body.scope in ("lecture", "active") and body.lecture_id else None
    matches = qdrant.search_similar(
        query_embedding=query_vec,
        user_id=user_id,
        limit=5,
        lecture_id=target_lecture_id,
        visibility_filter=True,
    )

    citations: list[AskCitation] = []
    for hit in matches:
        payload = hit.get("payload", {})
        c_text = payload.get("text") or payload.get("texts", "")
        s_ts = float(payload.get("start_ts", 0.0))
        e_ts = float(payload.get("end_ts", 0.0))
        c_id = str(hit.get("id") or f"chunk-{payload.get('chunk_index', 0)}")
        citations.append(
            AskCitation(
                lecture_id=payload.get("lecture_id", ""),
                lecture_title=payload.get("lecture_title", "Lecture Reference"),
                chunk_text=c_text,
                start_ts=s_ts,
                end_ts=e_ts,
                similarity=round(float(hit.get("score", 0.0)), 3),
                chunk_id=c_id,
                timestamp=s_ts,
                text=c_text,
            )
        )

    # 3. Call LLM or mock to synthesize response grounded in citations
    context = {
        "query": query_text,
        "user_id": user_id,
        "relevant_chunks": matches,
    }

    resp = await call_agent(
        agent_id=settings.LYZR_CONTENT_AGENT_ID,
        prompt=f"Answer the student question grounded only in these lecture citations: {query_text}",
        context=context,
        task_type="ask",
    )

    answer_text = resp.get("answer") if isinstance(resp, dict) else str(resp)

    return AskResponse(
        answer=answer_text,
        citations=citations,
    )
