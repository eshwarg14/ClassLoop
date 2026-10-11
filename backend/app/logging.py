"""Structured logging configuration using structlog."""

import contextvars
import logging
import sys
from collections.abc import MutableMapping
from typing import Any

import structlog

# Context variable to hold request_id across async calls
request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)

# Sensitive keys that must NEVER be logged directly, especially transcript text and secrets
SENSITIVE_KEYS = {
    "transcript",
    "transcript_text",
    "text",
    "raw_transcript",
    "secret",
    "api_key",
    "password",
    "token",
    "admin_token",
    "secret_key",
    "omi_webhook_secret",
}


def add_request_id(
    logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Processor to inject request_id from contextvars into logs."""
    req_id = request_id_ctx.get()
    if req_id:
        event_dict["request_id"] = req_id
    return event_dict


def scrub_sensitive_data(
    logger: Any, method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Processor to scrub transcript text and secret keys from event dictionaries."""
    for key in list(event_dict.keys()):
        key_lower = key.lower()
        if key_lower in SENSITIVE_KEYS or "token" in key_lower or "secret" in key_lower:
            # Mask the value rather than printing raw text or secret
            val = event_dict[key]
            if isinstance(val, str):
                event_dict[key] = f"[REDACTED_LEN_{len(val)}]"
            else:
                event_dict[key] = "[REDACTED]"
    return event_dict


def setup_logging(log_level: str = "INFO") -> None:
    """Configure structlog and standard library logging for JSON output."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Configure stdlib logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        add_request_id,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        scrub_sensitive_data,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ],
    )

    # Attach handler to root logger
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    root_logger.setLevel(level)


def get_logger(name: str = "classloop") -> structlog.stdlib.BoundLogger:
    """Obtain a structured logger instance."""
    return structlog.get_logger(name)
