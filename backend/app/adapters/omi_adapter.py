"""Omi webhook adapter for parsing, verifying, and deduplicating wearable audio transcripts."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

from app.core.chunker import Segment
from app.logging import get_logger

logger = get_logger("classloop.omi_adapter")

# In-memory tracking of seen segment IDs per session to prevent duplicates
_session_seen_segment_ids: dict[str, set[str]] = {}


def verify_webhook_signature(payload: bytes, signature: str | None, secret: str | None) -> bool:
    """
    Verify HMAC signature from Omi webhook.
    TODO(verify): Confirm whether Omi uses HMAC-SHA256 with hex digest or base64, and header prefix 'sha256='.
    """
    if not secret:
        # If no secret configured in demo mode / local, allow
        return True

    if not signature:
        return False

    # Standard HMAC-SHA256 signature check
    sig_to_check = signature.replace("sha256=", "").strip()
    computed = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig_to_check, computed)


def parse_webhook_payload(raw_data: dict[str, Any]) -> list[Segment]:
    """
    Parse Omi webhook payload into internal Segment model list.
    Expected Omi payload formats:
    Format A (Real-time segment stream):
      {
        "session_id": "...",
        "segments": [
          {"id": "seg_1", "text": "...", "speaker": "SPEAKER_00", "start": 0.0, "end": 4.5, "is_user": false}
        ]
      }
    Format B (Single segment):
      {
        "session_id": "...",
        "segment": {"id": "seg_1", "text": "...", "speaker": "SPEAKER_00", "start": 0.0, "end": 4.5}
      }
    Format C (Flat structure):
      {
        "id": "seg_1", "text": "...", "speaker": "lecturer", "start": 0.0, "end": 5.0, "session_id": "..."
      }
    TODO(verify): Verify exact JSON field names for speaker diarization in Omi firmware v2.
    """
    session_id = raw_data.get("session_id")
    segments: list[Segment] = []

    if "segments" in raw_data and isinstance(raw_data["segments"], list):
        for item in raw_data["segments"]:
            item_sess = item.get("session_id") or session_id
            seg = Segment(
                id=str(item.get("id") or item.get("segment_id") or f"seg_{len(segments)}"),
                text=str(item.get("text", "")).strip(),
                speaker=str(item.get("speaker") or "lecturer"),
                start=float(item.get("start", 0.0)),
                end=float(item.get("end", 0.0)),
                is_user=bool(item.get("is_user", False)),
                session_id=item_sess,
            )
            if seg.text:
                segments.append(seg)
    elif "segment" in raw_data and isinstance(raw_data["segment"], dict):
        item = raw_data["segment"]
        seg = Segment(
            id=str(item.get("id") or item.get("segment_id") or "seg_single"),
            text=str(item.get("text", "")).strip(),
            speaker=str(item.get("speaker") or "lecturer"),
            start=float(item.get("start", 0.0)),
            end=float(item.get("end", 0.0)),
            is_user=bool(item.get("is_user", False)),
            session_id=item.get("session_id") or session_id,
        )
        if seg.text:
            segments.append(seg)
    elif "text" in raw_data:
        seg = Segment(
            id=str(raw_data.get("id") or "seg_root"),
            text=str(raw_data.get("text", "")).strip(),
            speaker=str(raw_data.get("speaker") or "lecturer"),
            start=float(raw_data.get("start", 0.0)),
            end=float(raw_data.get("end", 0.0)),
            is_user=bool(raw_data.get("is_user", False)),
            session_id=session_id,
        )
        if seg.text:
            segments.append(seg)

    return segments


def deduplicate_segments(segments: list[Segment], seen_ids: set[str]) -> list[Segment]:
    """
    Deduplicate incoming segments against seen IDs set.
    Updates seen_ids in-place and returns only newly arrived segments.
    """
    new_segments: list[Segment] = []
    for s in segments:
        if s.id not in seen_ids:
            seen_ids.add(s.id)
            new_segments.append(s)
    return new_segments


def get_session_seen_ids(session_id: str) -> set[str]:
    """Get or create the seen IDs set for a session."""
    if session_id not in _session_seen_segment_ids:
        _session_seen_segment_ids[session_id] = set()
    return _session_seen_segment_ids[session_id]


def clear_session_seen_ids(session_id: str) -> None:
    """Clear memory buffer for a session upon lecture completion."""
    _session_seen_segment_ids.pop(session_id, None)
