"""Tests for database repositories and FastAPI API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import Base
from app.db.repo import (
    claim_pending_jobs,
    create_lecture,
    get_lecture,
    get_or_create_job,
    get_output,
    get_setting,
    get_traces_for_lecture,
    record_agent_trace,
    save_output,
    upsert_setting,
)
from app.main import app


@pytest.fixture
async def test_session():
    """Create in-memory SQLite database session for unit testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_db_crud(test_session: AsyncSession):
    # 1. Lecture
    lec = await create_lecture(test_session, user_id="u1", title="Operating Systems Lec 1")
    assert lec.id is not None
    fetched = await get_lecture(test_session, lec.id)
    assert fetched is not None
    assert fetched.title == "Operating Systems Lec 1"

    # 2. Job
    job, created = await get_or_create_job(test_session, lec.id)
    assert created is True
    assert job.status == "pending"
    # Idempotent
    job2, created2 = await get_or_create_job(test_session, lec.id)
    assert created2 is False
    assert job2.id == job.id

    # 3. Claim jobs
    claimed = await claim_pending_jobs(test_session, limit=1)
    assert len(claimed) == 1
    assert claimed[0].status == "running"

    # 4. Output
    out = await save_output(test_session, lec.id, "notes", {"summary": "OS Kernels"})
    assert out.output_type == "notes"
    fetched_out = await get_output(test_session, lec.id, "notes")
    assert fetched_out is not None
    assert fetched_out.content["summary"] == "OS Kernels"

    # 5. AgentTrace
    trace = await record_agent_trace(
        test_session,
        lecture_id=lec.id,
        agent_name="orchestrator",
        latency_ms=120,
    )
    assert trace.id is not None
    traces = await get_traces_for_lecture(test_session, lec.id)
    assert len(traces) == 1
    assert traces[0].agent_name == "orchestrator"

    # 6. Setting
    setting = await upsert_setting(test_session, "test_key", "enc_val_123")
    assert setting.key == "test_key"
    fetched_set = await get_setting(test_session, "test_key")
    assert fetched_set is not None
    assert fetched_set.encrypted_value == "enc_val_123"


@pytest.mark.asyncio
async def test_health_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liveness
        res_live = await client.get("/healthz")
        assert res_live.status_code == 200
        assert res_live.json() == {"status": "ok"}
