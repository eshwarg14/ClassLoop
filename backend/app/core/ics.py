"""iCalendar (.ics) generation for revision events."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, time
from typing import Any

from icalendar import Calendar, Event, vDatetime
from pydantic import BaseModel


def generate_revision_ics(
    events: list[Any],
    lecture_title: str = "ClassLoop Lecture Revision",
) -> bytes:
    """
    Generate .ics calendar file from revision schedule using icalendar.
    Each event:
    - Summary: topic name
    - Duration: 30 minutes
    - Description: confusion score and priority
    """
    cal = Calendar()
    cal.add("prodid", "-//ClassLoop//Lecture Revision Scheduler//EN")
    cal.add("version", "2.0")
    cal.add("x-wr-calname", f"{lecture_title} - Revision Plan")

    for ev in events:
        if isinstance(ev, BaseModel):
            ev_dict = ev.model_dump()
        elif isinstance(ev, dict):
            ev_dict = ev
        else:
            ev_dict = getattr(ev, "__dict__", {})

        topic = ev_dict.get("topic") or "Lecture Revision"
        date_str = ev_dict.get("date")
        priority = ev_dict.get("priority", "medium")
        score = ev_dict.get("confusion_score", 0.0)

        # Parse date
        try:
            if isinstance(date_str, str):
                d = datetime.fromisoformat(date_str).date()
            elif isinstance(date_str, datetime):
                d = date_str.date()
            else:
                d = datetime.now(UTC).date()
        except Exception:
            d = datetime.now(UTC).date()

        # Set start time to 09:00 AM local on that date
        dt_start = datetime.combine(d, time(hour=9, minute=0, second=0))
        dt_end = datetime.combine(d, time(hour=9, minute=30, second=0))

        cal_event = Event()
        cal_event.add("summary", f"Review: {topic}")
        cal_event.add("dtstart", vDatetime(dt_start))
        cal_event.add("dtend", vDatetime(dt_end))
        cal_event.add("dtstamp", vDatetime(datetime.now(UTC)))
        cal_event.add("uid", f"classloop-rev-{uuid.uuid4()}@classloop.local")

        desc = (
            f"ClassLoop Spaced Repetition Session\n"
            f"Topic: {topic}\n"
            f"Lecture: {lecture_title}\n"
            f"Confusion Score: {score:.2f}\n"
            f"Priority: {priority.upper()}\n"
            f"Suggested Review: 30 minutes active recall & quiz."
        )
        cal_event.add("description", desc)
        cal_event.add("priority", 1 if priority == "high" else (5 if priority == "medium" else 9))

        cal.add_component(cal_event)

    return cal.to_ical()
