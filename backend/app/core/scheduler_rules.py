"""Revision scheduling rules based on confusion scores per PRD."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from pydantic import BaseModel


class RevisionEventRule(BaseModel):
    """Event representation for revision schedule."""
    topic: str
    date: str  # YYYY-MM-DD
    priority: str  # 'high', 'medium', 'low'
    confusion_score: float
    day_offset: int


def calculate_revision_schedule(
    topics: list[dict[str, Any]],
    lecture_date: date | datetime | str | None = None,
) -> list[RevisionEventRule]:
    """
    Calculate spaced repetition revision schedule per PRD:
    - score >= 0.7: day 1, 2, 5, 10 (priority: 'high')
    - 0.4 <= score < 0.7: day 1, 3, 7 (priority: 'medium')
    - score < 0.4: day 7 only (priority: 'low')

    Input:
        topics: list of dicts or objects with 'name' (or 'topic'), 'confusion_score'
        lecture_date: base date of lecture (default: today)
    Output:
        list of RevisionEventRule sorted by date then priority
    """
    if lecture_date is None:
        base_date = date.today()
    elif isinstance(lecture_date, datetime):
        base_date = lecture_date.date()
    elif isinstance(lecture_date, date):
        base_date = lecture_date
    elif isinstance(lecture_date, str):
        try:
            base_date = datetime.fromisoformat(lecture_date).date()
        except ValueError:
            base_date = date.today()
    else:
        base_date = date.today()

    events: list[RevisionEventRule] = []

    for item in topics:
        topic_name = item.get("name") or item.get("topic") or "General Revision"
        score = float(item.get("confusion_score", 0.0))

        if score >= 0.7:
            offsets = [1, 2, 5, 10]
            priority = "high"
        elif score >= 0.4:
            offsets = [1, 3, 7]
            priority = "medium"
        else:
            offsets = [7]
            priority = "low"

        for offset in offsets:
            event_date = base_date + timedelta(days=offset)
            events.append(
                RevisionEventRule(
                    topic=topic_name,
                    date=event_date.isoformat(),
                    priority=priority,
                    confusion_score=score,
                    day_offset=offset,
                )
            )

    # Sort events chronologically, then by highest confusion score descending
    events.sort(key=lambda ev: (ev.date, -ev.confusion_score))
    return events
