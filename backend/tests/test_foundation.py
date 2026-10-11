"""Test suite for backend foundation."""

import pytest

from app.config import get_settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.events import EventBus


def test_config_defaults():
    from app.config import Settings

    settings = get_settings()
    assert settings.PORT == 8080
    assert isinstance(settings.DEMO_MODE, bool)
    assert Settings.model_fields["DEMO_MODE"].default is True
    assert settings.embedding_dimension == 384
    assert isinstance(settings.cors_origins_list, list)


def test_crypto_roundtrip():
    secret = "my-test-secret-key-12345678"
    plaintext = "super_secret_lyzr_api_token"
    encrypted = encrypt_value(plaintext, secret_key=secret)
    assert encrypted != plaintext
    decrypted = decrypt_value(encrypted, secret_key=secret)
    assert decrypted == plaintext


@pytest.mark.asyncio
async def test_event_bus():
    bus = EventBus()
    lecture_id = "test-lec-123"

    # Emit first so it enters history
    event = await bus.emit(
        lecture_id, "chunk_scored", {"score": 0.85, "reasons": ["question"]}
    )
    assert event.event_type == "chunk_scored"

    # Subscribe with last_event_id replay or test queue directly
    gen = bus.subscribe(lecture_id, last_event_id="__init__")
    item = await anext(gen)
    assert item["event"] == "chunk_scored"
    assert "0.85" in item["data"]
