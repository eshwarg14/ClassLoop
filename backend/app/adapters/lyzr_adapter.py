"""Lyzr agent adapter for calling Lyzr Studio v3 inference API or local deterministic fallback."""

from __future__ import annotations

import json
from typing import Any

import httpx

from app.adapters import llm_mock
from app.config import get_settings
from app.logging import get_logger

logger = get_logger("classloop.lyzr_adapter")


def _build_inference_url(base_url: str | None) -> str:
    """Resolve the Lyzr Studio v3 inference chat URL."""
    base = (base_url or "https://agent-prod.studio.lyzr.ai").rstrip("/")
    if base.endswith("/inference/chat"):
        return f"{base}/"
    if base.endswith("/v3"):
        return f"{base}/inference/chat/"
    return f"{base}/v3/inference/chat/"


def _format_message_with_context(prompt: str, context: dict[str, Any] | None, task_type: str | None) -> str:
    """Include relevant transcript chunks or topics in the message sent to Lyzr."""
    if not context:
        return prompt

    if task_type == "ask":
        chunks = context.get("relevant_chunks", [])
        if not chunks:
            return prompt
        lines = ["Retrieved Qdrant Organizational / Lecture Memory Context:"]
        for idx, hit in enumerate(chunks[:5]):
            payload = hit.get("payload", {})
            text = payload.get("text") or payload.get("texts", "")
            start_ts = payload.get("start_ts", 0.0)
            lines.append(f"[{idx + 1}] ({start_ts}s): {text}")
        lines.append(f"\nQuestion: {context.get('query', prompt)}")
        return "\n".join(lines)

    chunks = context.get("chunks", [])
    if chunks:
        snippet = "\n".join(
            f"[Chunk {c.get('chunk_index', i)}]: {(c.get('text') or c.get('texts', ''))[:200]}"
            for i, c in enumerate(chunks[:8])
        )
        return f"{prompt}\n\nTranscript Chunks:\n{snippet}"

    return prompt


def _fallback_for_task(task_type: str | None, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
    """Generate deterministic structured schema output for the requested task type."""
    chunks = context.get("chunks", [])
    topics = context.get("topics", [])
    title = context.get("lecture_title", "Operating Systems Lecture")

    if task_type == "detector":
        return llm_mock.mock_confusion_detection(chunks)
    if task_type == "content_notes":
        return llm_mock.mock_notes_generation(chunks, topics, lecture_title=title)
    if task_type == "content_quiz":
        return llm_mock.mock_quiz_generation(chunks, topics, lecture_title=title)
    if task_type == "scheduler":
        lecture_date = context.get("lecture_date")
        return llm_mock.mock_schedule_generation(topics, lecture_date=lecture_date)
    if task_type == "ask":
        query = context.get("query", prompt)
        return llm_mock.mock_ask_answer(query, context.get("relevant_chunks", []))
    return {"response": f"Processed prompt: {prompt[:50]}..."}


async def call_agent(
    agent_id: str | None,
    prompt: str,
    context: dict[str, Any] | None = None,
    task_type: str | None = None,
) -> dict[str, Any]:
    """
    Call a Lyzr Studio v3 agent via API or delegate to llm_mock if DEMO_MODE or key is absent.

    Lyzr Studio v3 Inference Endpoint:
    POST https://agent-prod.studio.lyzr.ai/v3/inference/chat/
    Headers:
      x-api-key: {LYZR_API_KEY}
      Content-Type: application/json
    Body:
      {
        "user_id": "u1",
        "agent_id": agent_id,
        "session_id": "session_1",
        "message": prompt
      }
    """
    settings = get_settings()
    context = context or {}
    effective_agent_id = agent_id or settings.AGENT_ID or settings.LYZR_ORCHESTRATOR_AGENT_ID

    # In DEMO_MODE or if no Lyzr key is configured, delegate directly to llm_mock
    if settings.DEMO_MODE or not settings.LYZR_API_KEY or not effective_agent_id:
        logger.debug("lyzr_delegating_to_mock", task_type=task_type, agent_id=effective_agent_id)
        return _fallback_for_task(task_type, prompt, context)

    url = _build_inference_url(settings.LYZR_BASE_URL)
    headers = {
        "x-api-key": settings.LYZR_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "user_id": context.get("user_id", "u1"),
        "agent_id": effective_agent_id,
        "session_id": context.get("session_id", "sess_classloop"),
        "message": _format_message_with_context(prompt, context, task_type),
    }

    req_timeout = 15.0 if task_type == "ask" else 6.0
    try:
        async with httpx.AsyncClient(timeout=req_timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            raw_response = data.get("response") or data.get("message") or data

            parsed: Any = raw_response
            if isinstance(raw_response, str):
                try:
                    parsed = json.loads(raw_response)
                except Exception:
                    parsed = raw_response

            # For Q&A ('ask'), return the grounded answer string directly
            if task_type == "ask":
                if isinstance(parsed, dict) and "answer" in parsed:
                    return parsed
                if isinstance(parsed, str) and parsed.strip():
                    # If the RAG agent says it has no record and we have chunks, or returns a valid answer:
                    return {"answer": parsed.strip()}
                return _fallback_for_task(task_type, prompt, context)

            # For structured pipeline tasks, verify the expected top-level key is present;
            # if the connected Lyzr agent returns a general/task-splitter schema (e.g. decisions/tasks),
            # enrich the structured pipeline output so Pydantic validation succeeds cleanly.
            if isinstance(parsed, dict):
                if task_type == "detector" and "topics" in parsed:
                    return parsed
                if task_type == "content_notes" and "sections" in parsed:
                    return parsed
                if task_type == "content_quiz" and "questions" in parsed:
                    return parsed
                if task_type == "scheduler" and "events" in parsed:
                    return parsed

            return _fallback_for_task(task_type, prompt, context)
    except Exception as exc:
        logger.warning("lyzr_agent_call_fallback", agent_id=effective_agent_id, task_type=task_type, error=str(exc))
        return _fallback_for_task(task_type, prompt, context)
