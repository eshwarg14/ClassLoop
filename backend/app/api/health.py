"""Health and readiness check endpoints."""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, Response, status
from qdrant_client import QdrantClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.deps import get_current_settings, get_db, get_qdrant_store

logger = structlog.get_logger("classloop.health")

router = APIRouter(tags=["Health"])


@router.get("/healthz", summary="Liveness Probe")
async def healthz() -> dict[str, str]:
    """Basic liveness probe that always returns ok."""
    return {"status": "ok"}


@router.get("/readyz", summary="Readiness Probe")
async def readyz(
    response: Response,
    db: AsyncSession = Depends(get_db),
    qdrant: QdrantClient = Depends(get_qdrant_store),
    settings: Settings = Depends(get_current_settings),
) -> dict[str, Any]:
    """
    Readiness probe that checks connectivity to Database and Qdrant.
    Returns HTTP 200 if all components are healthy, otherwise HTTP 503.
    """
    checks: dict[str, Any] = {
        "database": {"status": "unknown"},
        "qdrant": {"status": "unknown"},
    }
    is_ready = True

    # 1. Database check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = {
            "status": "healthy",
            "type": "postgres" if "postgres" in settings.DATABASE_URL else "sqlite",
        }
    except Exception as exc:
        is_ready = False
        logger.error("readiness_db_failed", error=str(exc))
        checks["database"] = {
            "status": "unhealthy",
            "error": str(exc),
        }

    # 2. Qdrant check
    try:
        collections = qdrant.get_collections().collections
        exists = any(c.name == settings.QDRANT_COLLECTION for c in collections)
        checks["qdrant"] = {
            "status": "healthy",
            "mode": "cloud" if settings.is_qdrant_cloud else "embedded",
            "collection": settings.QDRANT_COLLECTION,
            "collection_exists": exists,
        }
    except Exception as exc:
        is_ready = False
        logger.error("readiness_qdrant_failed", error=str(exc))
        checks["qdrant"] = {
            "status": "unhealthy",
            "error": str(exc),
        }

    overall_status = "ok" if is_ready else "degraded"
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall_status,
        "app_env": settings.APP_ENV,
        "demo_mode": settings.DEMO_MODE,
        "checks": checks,
    }
