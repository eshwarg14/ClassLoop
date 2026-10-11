"""Server-Sent Events streaming endpoint for real-time lecture updates."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, Request
from sse_starlette.sse import EventSourceResponse

from app.core.events import EventBus, get_event_bus

logger = structlog.get_logger("classloop.stream")

router = APIRouter(prefix="/api/stream", tags=["Streaming"])


@router.get(
    "/{lecture_id}",
    summary="Real-time Lecture Event Stream",
    response_class=EventSourceResponse,
)
async def stream_lecture_events(
    lecture_id: str,
    request: Request,
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
    event_bus: EventBus = Depends(get_event_bus),
) -> EventSourceResponse:
    """
    Establish an SSE connection to receive live lecture events.
    Events emitted:
    - segment: new transcription segment received
    - chunk_scored: confusion score computed for chunk
    - flag_added: manual confusion flag registered
    - lecture_ended: lecture ended trigger fired
    - agent_step: autonomous agent pipeline step progression
    - output_ready: generated notes, quiz, or schedule is available

    Supports auto-reconnection via standard Last-Event-ID header.
    """
    logger.info("stream_connection_initiated", lecture_id=lecture_id, last_event_id=last_event_id)

    event_generator = event_bus.subscribe(
        lecture_id=lecture_id,
        last_event_id=last_event_id,
    )

    return EventSourceResponse(
        event_generator,
        ping=15,  # Send keepalive ping comment every 15 seconds
    )
