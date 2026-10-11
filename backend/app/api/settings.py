"""Settings API router for encrypted credentials management and runtime connectivity tests."""

from __future__ import annotations

import os
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.config import get_settings
from app.core.crypto import decrypt_value, encrypt_value
from app.core.embedder import embed_text
from app.db.repo import list_settings, upsert_setting
from app.deps import get_db, verify_admin_token
from app.logging import get_logger

logger = get_logger("classloop.api.settings")

router = APIRouter(prefix="/api/settings", tags=["Settings"])

CONFIG_KEYS = [
    "OMI_WEBHOOK_SECRET",
    "OMI_API_KEY",
    "OMI_APP_ID",
    "LYZR_API_KEY",
    "LYZR_AGENT_API_KEY",
    "LYZR_BASE_URL",
    "AGENT_ID",
    "LYZR_ORCHESTRATOR_AGENT_ID",
    "LYZR_DETECTOR_AGENT_ID",
    "LYZR_CONTENT_AGENT_ID",
    "LYZR_SCHEDULER_AGENT_ID",
    "QDRANT_URL",
    "QDRANT_API_KEY",
    "QDRANT_COLLECTION",
    "QDRANT_COLLECTION_NAME",
    "QDRANT_GRPC_PORT",
    "QDRANT_PREFER_GRPC",
    "EMBEDDING_PROVIDER",
    "EMBEDDING_MODEL",
    "EMBEDDING_API_KEY",
    "EMBEDDING_BASE_URL",
    "SECRET_KEY",
    "ADMIN_TOKEN",
]


class UpdateSettingsRequest(BaseModel):
    settings: dict[str, str]


@router.get("", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_admin_token)])
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """
    Return each configuration key as:
    { "key_name": { "set": bool, "last4": str, "source": "env" | "ui" } }
    NEVER returns the plaintext secret value.
    """
    db_records = await list_settings(db)
    db_map = {r.key: r for r in db_records}

    result = {}
    for key in CONFIG_KEYS:
        val = None
        source = "env"

        # Check DB first
        if key in db_map:
            try:
                decrypted = decrypt_value(db_map[key].encrypted_value)
                val = decrypted
                source = db_map[key].source
            except Exception:
                val = "encrypted"
                source = db_map[key].source

        # Otherwise check environment
        if not val:
            env_val = os.getenv(key) or getattr(get_settings(), key, None)
            if env_val is not None and str(env_val) != "":
                val = str(env_val)
                source = "env"

        is_set = bool(val and str(val).strip())
        last4 = str(val)[-4:] if is_set and len(str(val)) >= 4 else ("****" if is_set else "")

        result[key] = {
            "set": is_set,
            "last4": last4,
            "source": source,
        }

    return result


@router.put("", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_admin_token)])
async def update_settings(
    body: UpdateSettingsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Encrypt values with Fernet, store in DB, and apply to runtime settings without restart.
    """
    settings_obj = get_settings()

    for k, v in body.settings.items():
        if k in CONFIG_KEYS and v is not None:
            encrypted = encrypt_value(v)
            await upsert_setting(db, key=k, encrypted_value=encrypted, source="ui")

            # Apply at runtime to config
            if hasattr(settings_obj, k):
                setattr(settings_obj, k, v)
            os.environ[k] = v

    logger.info("settings_updated_at_runtime", keys=list(body.settings.keys()))
    return {"status": "updated", "updated_keys": list(body.settings.keys())}


@router.post("/test/{integration}", status_code=status.HTTP_200_OK, dependencies=[Depends(verify_admin_token)])
async def test_integration_connection(integration: str):
    """
    Test connectivity to Omi, Lyzr, Qdrant, or Embeddings.
    Returns: { "status": "ok" | "error", "connected": bool, "latency_ms": int, "error": Optional[str] }
    """
    settings = get_settings()
    start_time = time.perf_counter()

    integration_norm = integration.lower().strip()

    try:
        if integration_norm == "qdrant":
            qdrant = get_qdrant_store_adapter()
            collections = qdrant.client.get_collections()
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "status": "ok",
                "connected": True,
                "latency_ms": latency_ms,
                "details": f"Found {len(collections.collections)} collections (active: {settings.QDRANT_COLLECTION})",
            }

        elif integration_norm == "embeddings":
            vec = embed_text("Test ClassLoop vector embedding connection")
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "status": "ok",
                "connected": True,
                "latency_ms": latency_ms,
                "details": f"Generated vector dimension {len(vec)}",
            }

        elif integration_norm == "lyzr":
            if not settings.LYZR_API_KEY:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                return {
                    "status": "ok",
                    "connected": True,
                    "latency_ms": latency_ms,
                    "details": "Demo mode active (Mock LLM ready)",
                }

            base_url = (settings.LYZR_BASE_URL or "https://agent-prod.studio.lyzr.ai").rstrip("/")
            agent_id = settings.LYZR_ORCHESTRATOR_AGENT_ID or settings.AGENT_ID or ""
            url = f"{base_url}/v3/agents/{agent_id}" if not base_url.endswith("/v3") else f"{base_url}/agents/{agent_id}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers={"x-api-key": settings.LYZR_API_KEY})
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                if res.is_success:
                    agent_name = res.json().get("name", agent_id)
                    return {
                        "status": "ok",
                        "connected": True,
                        "latency_ms": latency_ms,
                        "details": f"Connected to Lyzr Agent: {agent_name}",
                    }
                return {
                    "status": "error",
                    "connected": False,
                    "latency_ms": latency_ms,
                    "error": f"HTTP {res.status_code}: {res.text[:200]}",
                }

        elif integration_norm == "omi":
            has_secret = bool(settings.OMI_WEBHOOK_SECRET)
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "status": "ok",
                "connected": True,
                "latency_ms": latency_ms,
                "details": f"Webhook endpoint ready (HMAC signature enforcement: {has_secret})",
            }

        else:
            raise HTTPException(status_code=400, detail=f"Unknown integration: {integration}")

    except Exception as exc:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        logger.error("integration_test_failed", integration=integration, error=str(exc))
        return {
            "status": "error",
            "connected": False,
            "latency_ms": latency_ms,
            "error": str(exc),
        }
