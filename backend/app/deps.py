"""FastAPI dependency injection providers."""

from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from qdrant_client import QdrantClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import get_db_session

security_bearer = HTTPBearer(auto_error=False)
_qdrant_client: QdrantClient | None = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for async database sessions."""
    async for session in get_db_session():
        yield session


def get_current_settings() -> Settings:
    """Dependency for application settings."""
    return get_settings()


def get_qdrant_store(settings: Settings = Depends(get_current_settings)) -> QdrantClient:
    """Dependency providing the connected Qdrant client."""
    global _qdrant_client
    if _qdrant_client is None:
        from app.adapters.qdrant_store import get_qdrant_store_adapter

        _qdrant_client = get_qdrant_store_adapter().client
    return _qdrant_client


def get_current_user_id(
    x_user_id: Annotated[str | None, Header(alias="X-User-ID")] = None,
) -> str:
    """Extract current user ID from X-User-ID header, defaulting to 'u1'."""
    if x_user_id and x_user_id.strip():
        return x_user_id.strip()
    return "u1"


async def verify_admin_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security_bearer),
    x_admin_token: Annotated[str | None, Header(alias="X-Admin-Token")] = None,
    settings: Settings = Depends(get_current_settings),
) -> bool:
    """
    Verify admin token via either Authorization: Bearer <token> or X-Admin-Token header.
    Raises HTTPException 401 if token is missing or invalid.
    """
    token: str | None = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif x_admin_token:
        token = x_admin_token

    if not token or token != settings.ADMIN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return True
