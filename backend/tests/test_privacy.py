"""Privacy and multi-tenant isolation tests for Qdrant vectors and API endpoints."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from qdrant_client import QdrantClient

from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.core.embedder import embed_text
from app.main import app, run_db_migrations


@pytest.fixture
def isolated_qdrant():
    """Fresh in-memory Qdrant store for privacy isolation testing."""
    mem_client = QdrantClient(":memory:")
    store = get_qdrant_store_adapter(client=mem_client)
    return store


@pytest.mark.asyncio
async def test_multi_user_isolation_and_zero_leakage(isolated_qdrant):
    """
    Ingests chunks for user_id='u1' and user_id='u2'.
    Proves u2 cannot retrieve u1's private chunks via:
      - search_similar
      - get_lecture_chunks
      - GET /api/memories
      - POST /api/ask
    """
    await run_db_migrations()

    vec_u1 = embed_text("Confidential u1 kernel deadlock discussion on mutex ordering.")
    vec_u2 = embed_text("u2 introductory notes on file system permissions.")
    pt_u1_id = str(uuid.uuid4())
    pt_u2_id = str(uuid.uuid4())

    isolated_qdrant.upsert_chunks(
        lecture_id="lec_u1_secret",
        user_id="u1",
        chunks_with_embeddings=[
            {
                "id": pt_u1_id,
                "chunk_index": 0,
                "start_ts": 0.0,
                "end_ts": 30.0,
                "speaker": "lecturer",
                "text": "Confidential u1 kernel deadlock discussion on mutex ordering.",
                "embedding": vec_u1,
                "confusion_score": 0.85,
                "reasons": ["Manual"],
            }
        ],
        visibility="private",
    )

    isolated_qdrant.upsert_chunks(
        lecture_id="lec_u2_public",
        user_id="u2",
        chunks_with_embeddings=[
            {
                "id": pt_u2_id,
                "chunk_index": 0,
                "start_ts": 0.0,
                "end_ts": 30.0,
                "speaker": "lecturer",
                "text": "u2 introductory notes on file system permissions.",
                "embedding": vec_u2,
                "confusion_score": 0.2,
                "reasons": [],
            }
        ],
        visibility="private",
    )

    # 1. Direct Qdrant adapter checks: u2 searching with u1's exact vector
    u2_search_hits = isolated_qdrant.search_similar(
        query_embedding=vec_u1,
        user_id="u2",
        limit=10,
    )
    assert all(h["payload"]["user_id"] == "u2" for h in u2_search_hits)
    assert not any("Confidential u1" in h["payload"].get("text", "") for h in u2_search_hits)

    # 2. Direct get_lecture_chunks check: u2 querying u1's lecture_id
    u2_lecture_chunks = isolated_qdrant.get_lecture_chunks(lecture_id="lec_u1_secret", user_id="u2")
    assert u2_lecture_chunks == []

    # 3. API checks with X-User-ID header
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # GET /api/memories as u2
        res_mem_u2 = await client.get("/api/memories", headers={"X-User-ID": "u2"})
        assert res_mem_u2.status_code == 200
        mem_u2 = res_mem_u2.json()
        assert len(mem_u2) == 1
        assert mem_u2[0]["id"] == pt_u2_id
        assert all("Confidential u1" not in m["text"] for m in mem_u2)

        # POST /api/ask as u2 asking about u1's secret topic
        res_ask_u2 = await client.post(
            "/api/ask",
            json={"query": "Confidential u1 kernel deadlock mutex ordering", "scope": "all"},
            headers={"X-User-ID": "u2"},
        )
        assert res_ask_u2.status_code == 200
        ask_u2 = res_ask_u2.json()
        for cit in ask_u2.get("citations", []):
            assert cit["lecture_id"] != "lec_u1_secret"
            assert "Confidential u1" not in cit["chunk_text"]


@pytest.mark.asyncio
async def test_visibility_toggle_and_ephemeral_expiry(isolated_qdrant):
    """
    Tests PATCH /api/memories/{id}/visibility and expired ephemeral point cleanup.
    """
    await run_db_migrations()
    vec = embed_text("Temporary ephemeral study chunk")
    pt_eph_id = str(uuid.uuid4())

    isolated_qdrant.upsert_chunks(
        lecture_id="lec_eph_1",
        user_id="u1",
        chunks_with_embeddings=[
            {
                "id": pt_eph_id,
                "chunk_index": 0,
                "start_ts": 0.0,
                "end_ts": 20.0,
                "speaker": "lecturer",
                "text": "Temporary ephemeral study chunk",
                "embedding": vec,
                "confusion_score": 0.4,
            }
        ],
        visibility="private",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Change visibility to ephemeral with a past expiration timestamp
        past_iso = (datetime.now(UTC) - timedelta(hours=2)).isoformat()
        res_patch = await client.patch(
            f"/api/memories/{pt_eph_id}/visibility",
            json={"visibility": "ephemeral", "expires_at": past_iso},
            headers={"X-User-ID": "u1"},
        )
        assert res_patch.status_code == 200
        assert res_patch.json()["visibility"] == "ephemeral"

        # Expired ephemeral chunk should already be excluded from search_similar
        hits = isolated_qdrant.search_similar(query_embedding=vec, user_id="u1")
        assert hits == []

        # Trigger ephemeral cleanup endpoint
        res_cleanup = await client.post("/api/cleanup/ephemeral")
        assert res_cleanup.status_code == 200
        assert res_cleanup.json()["cleaned_points_count"] == 1

        # Verify point is permanently gone from Qdrant
        remaining = isolated_qdrant.list_user_points(user_id="u1")
        assert remaining == []


@pytest.mark.asyncio
async def test_forget_lecture_deletes_vectors_and_db_rows(isolated_qdrant):
    """
    Tests DELETE /api/lectures/{id}/forget and DELETE /lectures/{id} remove all Qdrant vectors and DB rows.
    """
    await run_db_migrations()
    vec = embed_text("Lecture chunk to be forgotten completely")
    pt_forget_id = str(uuid.uuid4())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create lecture via API
        res_create = await client.post(
            "/api/lectures",
            json={"title": "Lecture To Forget"},
            headers={"X-User-ID": "u1"},
        )
        assert res_create.status_code == 201
        lec_id = res_create.json()["id"]

        # Upsert chunks for this lecture
        isolated_qdrant.upsert_chunks(
            lecture_id=lec_id,
            user_id="u1",
            chunks_with_embeddings=[
                {
                    "id": pt_forget_id,
                    "chunk_index": 0,
                    "text": "Lecture chunk to be forgotten completely",
                    "embedding": vec,
                    "confusion_score": 0.5,
                }
            ],
        )
        assert len(isolated_qdrant.get_lecture_chunks(lec_id, "u1")) == 1

        # Call DELETE /api/lectures/{id}/forget
        res_forget = await client.delete(
            f"/api/lectures/{lec_id}/forget",
            headers={"X-User-ID": "u1"},
        )
        assert res_forget.status_code == 200
        assert res_forget.json()["deleted"] is True

        # Verify Qdrant points are 0 and DB lecture returns 404
        assert isolated_qdrant.get_lecture_chunks(lec_id, "u1") == []
        res_get = await client.get(f"/api/lectures/{lec_id}")
        assert res_get.status_code == 404

        # Also test root alias DELETE /lectures/{id}
        res_create2 = await client.post(
            "/lectures",
            json={"title": "Second Lecture To Delete"},
            headers={"X-User-ID": "u1"},
        )
        assert res_create2.status_code == 201
        lec_id2 = res_create2.json()["id"]

        res_del2 = await client.delete(f"/lectures/{lec_id2}", headers={"X-User-ID": "u1"})
        assert res_del2.status_code == 200
        assert res_del2.json()["deleted"] is True
        res_get2 = await client.get(f"/lectures/{lec_id2}")
        assert res_get2.status_code == 404
