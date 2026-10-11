"""In-memory Server-Sent Events (SSE) event bus for real-time lecture streaming."""

import asyncio
import json
import uuid
from collections import defaultdict
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any, Literal

import structlog

logger = structlog.get_logger("classloop.events")

EventType = Literal[
    "segment",
    "chunk_scored",
    "flag_added",
    "lecture_ended",
    "agent_step",
    "output_ready",
]


class SSEEvent:
    """Represents a single typed SSE event."""

    def __init__(
        self,
        event_type: EventType,
        data: dict[str, Any],
        lecture_id: str,
        event_id: str | None = None,
    ):
        self.event_id = event_id or str(uuid.uuid4())
        self.event_type = event_type
        self.lecture_id = lecture_id
        self.data = data
        self.timestamp = datetime.now(UTC).isoformat()

    def to_sse_payload(self) -> dict[str, Any]:
        """Convert to dict structure compatible with sse-starlette."""
        payload_data = {
            **self.data,
            "event_type": self.event_type,
            "lecture_id": self.lecture_id,
            "timestamp": self.timestamp,
        }
        return {
            "id": self.event_id,
            "event": self.event_type,
            "data": json.dumps(payload_data),
        }


class EventBus:
    """Async event bus managing subscriptions per lecture_id."""

    def __init__(self, history_limit: int = 100):
        # lecture_id -> set of asyncio.Queue
        self._subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
        # lecture_id -> list of recent SSEEvent for reconnection playback
        self._history: dict[str, list[SSEEvent]] = defaultdict(list)
        self._history_limit = history_limit
        self._lock = asyncio.Lock()

    async def emit(
        self,
        lecture_id: str,
        event_type: EventType,
        data: dict[str, Any],
    ) -> SSEEvent:
        """Emit an event to all active subscribers for the given lecture_id."""
        event = SSEEvent(
            event_type=event_type,
            data=data,
            lecture_id=lecture_id,
        )

        async with self._lock:
            # Store in ring buffer history
            hist = self._history[lecture_id]
            hist.append(event)
            if len(hist) > self._history_limit:
                hist.pop(0)

            # Broadcast to queues
            queues = list(self._subscribers.get(lecture_id, set()))

        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(
                    "subscriber_queue_full",
                    lecture_id=lecture_id,
                    event_type=event_type,
                )

        logger.debug(
            "event_emitted",
            lecture_id=lecture_id,
            event_type=event_type,
            subscriber_count=len(queues),
        )
        return event

    async def subscribe(
        self,
        lecture_id: str,
        last_event_id: str | None = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Subscribe to events for a specific lecture_id.
        Replays missed events if last_event_id is provided and present in history.
        Yields SSE dictionaries for sse-starlette.
        """
        queue: asyncio.Queue[SSEEvent] = asyncio.Queue(maxsize=200)

        async with self._lock:
            self._subscribers[lecture_id].add(queue)

            # Check if we should replay history from last_event_id
            missed_events: list[SSEEvent] = []
            if last_event_id:
                hist = self._history.get(lecture_id, [])
                replay_started = False
                for ev in hist:
                    if replay_started:
                        missed_events.append(ev)
                    elif ev.event_id == last_event_id:
                        replay_started = True

                # If last_event_id wasn't found in history, send full recent history
                if not replay_started and hist:
                    missed_events = list(hist)

            for missed in missed_events:
                queue.put_nowait(missed)

        logger.info("sse_client_subscribed", lecture_id=lecture_id)

        try:
            while True:
                event = await queue.get()
                yield event.to_sse_payload()
                queue.task_done()
        except asyncio.CancelledError:
            logger.info("sse_client_disconnected", lecture_id=lecture_id)
            raise
        finally:
            async with self._lock:
                if queue in self._subscribers.get(lecture_id, set()):
                    self._subscribers[lecture_id].remove(queue)
                if not self._subscribers.get(lecture_id):
                    self._subscribers.pop(lecture_id, None)

    async def clear_lecture(self, lecture_id: str) -> None:
        """Clear all subscribers and history for a lecture."""
        async with self._lock:
            self._subscribers.pop(lecture_id, None)
            self._history.pop(lecture_id, None)


# Global singleton event bus
event_bus = EventBus()


def get_event_bus() -> EventBus:
    """Dependency getter for event bus."""
    return event_bus
