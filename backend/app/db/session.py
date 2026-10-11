"""Async SQLAlchemy engine and session factory configuration."""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""
    pass


_engine: AsyncEngine | None = None
_session_maker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Get or create singleton async engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        db_url = settings.DATABASE_URL

        # Ensure sqlite parent directory exists if using local sqlite
        if "sqlite" in db_url:
            # Format sqlite+aiosqlite:///./data/classloop.db
            db_path_str = db_url.split("///")[-1]
            if db_path_str and not db_path_str.startswith(":memory:"):
                db_path = Path(db_path_str).resolve()
                db_path.parent.mkdir(parents=True, exist_ok=True)

            _engine = create_async_engine(
                db_url,
                echo=False,
                connect_args={"check_same_thread": False},
                pool_pre_ping=True,
            )
        else:
            _engine = create_async_engine(
                db_url,
                echo=False,
                pool_pre_ping=True,
            )
    return _engine


def get_session_maker() -> async_sessionmaker[AsyncSession]:
    """Get or create async session maker."""
    global _session_maker
    if _session_maker is None:
        engine = get_engine()
        _session_maker = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _session_maker


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async session context for dependency injection."""
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
