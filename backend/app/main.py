"""Main FastAPI application entry point for ClassLoop."""

import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from qdrant_client.http import models as qmodels
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.ask import router as ask_router
from app.api.health import router as health_router
from app.api.lectures import demo_router
from app.api.lectures import router as lectures_router
from app.api.privacy import router as privacy_router
from app.api.settings import router as settings_router
from app.api.stream import router as stream_router
from app.api.webhook import router as webhook_router
from app.config import get_settings
from app.core.jobs import get_job_runner
from app.db.models import Base
from app.db.repo import get_pending_jobs_on_startup
from app.db.session import get_engine, get_session_maker
from app.logging import get_logger, request_id_ctx, setup_logging

# Load root .env file before initializing settings
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

settings = get_settings()
setup_logging(log_level=settings.LOG_LEVEL)
logger = get_logger("classloop.main")

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)


async def run_db_migrations() -> None:
    """Run migrations and verify schema on startup."""
    engine = get_engine()
    logger.info("verifying_database_tables", url=settings.DATABASE_URL.split("@")[-1])
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database_tables_ready")


def init_qdrant_collection() -> None:
    """Initialize Qdrant collection and validate vector dimension."""
    from app.adapters.qdrant_store import get_qdrant_store_adapter

    logger.info("initializing_qdrant_collection", collection=settings.QDRANT_COLLECTION)
    adapter = get_qdrant_store_adapter()
    client = adapter.client

    collections_response = client.get_collections()
    exists = any(c.name == settings.QDRANT_COLLECTION for c in collections_response.collections)

    expected_dim = settings.embedding_dimension
    if not exists:
        logger.info(
            "creating_qdrant_collection",
            collection=settings.QDRANT_COLLECTION,
            dimension=expected_dim,
        )
        client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=qmodels.VectorParams(
                size=expected_dim,
                distance=qmodels.Distance.COSINE,
            ),
        )
    else:
        # Validate existing collection vector dimension
        info = client.get_collection(collection_name=settings.QDRANT_COLLECTION)
        params = info.config.params.vectors
        if isinstance(params, qmodels.VectorParams):
            actual_dim = params.size
            if actual_dim != expected_dim:
                msg = (
                    f"Qdrant collection '{settings.QDRANT_COLLECTION}' dimension {actual_dim} "
                    f"mismatches configured embedding dimension {expected_dim}!"
                )
                logger.error("qdrant_dimension_mismatch", actual=actual_dim, expected=expected_dim)
                raise RuntimeError(msg)
    logger.info("qdrant_collection_ready", collection=settings.QDRANT_COLLECTION, dimension=expected_dim)


async def resume_unfinished_jobs() -> None:
    """Resume any unfinished jobs from earlier server runs."""
    session_maker = get_session_maker()
    async with session_maker() as session:
        pending_jobs = await get_pending_jobs_on_startup(session)
        logger.info("startup_pending_jobs_resumed", count=len(pending_jobs))
        for job in pending_jobs:
            logger.info("pending_job_found", job_id=job.id, lecture_id=job.lecture_id, attempts=job.attempts)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # 1. Print formatted integration status table
    settings.print_config_table()

    # 2. Database migrations / schema creation
    await run_db_migrations()

    # 3. Initialize & validate Qdrant vector collection
    init_qdrant_collection()

    # 4. Resume pending jobs and start background JobRunner
    await resume_unfinished_jobs()
    job_runner = get_job_runner()
    await job_runner.start()

    logger.info("classloop_backend_started", port=settings.PORT, env=settings.APP_ENV)
    yield

    # Shutdown cleanup
    logger.info("classloop_backend_shutting_down")
    await job_runner.stop()
    engine = get_engine()
    await engine.dispose()
    logger.info("classloop_backend_shutdown_complete")


app = FastAPI(
    title="ClassLoop Backend",
    description="Autonomous lecture intelligence backend engine",
    version="0.1.0",
    lifespan=lifespan,
)

# SlowAPI rate limiting state & exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_and_logging_middleware(request: Request, call_next):
    """Inject request ID into contextvars and record structured HTTP access logs."""
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    token = request_id_ctx.set(req_id)
    start_time = time.perf_counter()

    try:
        response: Response = await call_next(request)
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = req_id

        # Do not log healthz repeatedly at INFO level
        if request.url.path not in ("/healthz", "/readyz"):
            logger.info(
                "http_request_processed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                latency_ms=latency_ms,
                client_ip=request.client.host if request.client else None,
            )
        return response
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            "http_request_failed",
            method=request.method,
            path=request.url.path,
            latency_ms=latency_ms,
            error=str(exc),
        )
        raise
    finally:
        request_id_ctx.reset(token)


# Include Foundation & Phase 4 API routers (both /api/... and root /... aliases)
app.include_router(health_router)
app.include_router(stream_router)
app.include_router(webhook_router)
app.include_router(webhook_router, prefix="/api", include_in_schema=False)
app.include_router(lectures_router, prefix="/api")
app.include_router(lectures_router, include_in_schema=False)
app.include_router(demo_router, prefix="/api")
app.include_router(demo_router, include_in_schema=False)
app.include_router(ask_router, prefix="/api")
app.include_router(ask_router, include_in_schema=False)
app.include_router(privacy_router, prefix="/api")
app.include_router(privacy_router, include_in_schema=False)
app.include_router(settings_router)


# Frontend static files and SPA fallback
frontend_dist = ROOT_DIR / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_fallback(full_path: str):
        # Allow API routes, docs, and webhooks to bypass fallback
        if (
            full_path.startswith("api/")
            or full_path.startswith("webhook/")
            or full_path.startswith("lectures/")
            or full_path == "ask"
            or full_path.startswith("memories/")
            or full_path in ("healthz", "readyz", "docs", "redoc", "openapi.json")
        ):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/", include_in_schema=False)
    async def root_placeholder():
        return {
            "message": "ClassLoop Backend Running",
            "docs": "/docs",
            "health": "/healthz",
            "ready": "/readyz",
        }
