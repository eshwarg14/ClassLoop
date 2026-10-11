"""End-to-end replay test using scripts/sample_lecture.json through webhook, orchestrator, and output endpoints."""

import json
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from qdrant_client import QdrantClient

from app.adapters.omi_adapter import clear_session_seen_ids
from app.adapters.qdrant_store import get_qdrant_store_adapter
from app.api.webhook import get_session_buffers
from app.core.jobs import get_job_runner
from app.main import app, run_db_migrations


@pytest.fixture
def isolated_qdrant():
    """Use an in-memory QdrantClient so tests run fast and without file-lock contention."""
    mem_client = QdrantClient(":memory:")
    store = get_qdrant_store_adapter(client=mem_client)
    return store


@pytest.mark.asyncio
async def test_e2e_sample_lecture_replay(isolated_qdrant):
    """
    Full E2E test:
    1. Replays scripts/sample_lecture.json through POST /webhook/omi
    2. Calls POST /api/lectures/{id}/end
    3. Runs the job runner / orchestrator to completion
    4. Verifies /notes, /quiz, /schedule.ics, and /trace
    """
    await run_db_migrations()

    root_dir = Path(__file__).resolve().parent.parent.parent
    sample_file = root_dir / "scripts" / "sample_lecture.json"
    assert sample_file.exists(), "scripts/sample_lecture.json must exist"

    sample_data = json.loads(sample_file.read_text(encoding="utf-8"))
    session_id = "e2e_replay_session_001"
    clear_session_seen_ids(session_id)
    get_session_buffers().pop(session_id, None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Replay segments through /webhook/omi
        webhook_payload = {
            "session_id": session_id,
            "user_id": "u1",
            "lecture_title": sample_data["lecture_title"],
            "segments": sample_data["segments"],
        }
        res_wh = await client.post("/webhook/omi", json=webhook_payload)
        assert res_wh.status_code == 200
        wh_data = res_wh.json()
        assert wh_data["status"] == "ok"
        assert wh_data["processed_segments"] == len(sample_data["segments"])
        lecture_id = wh_data["lecture_id"]
        assert lecture_id

        # 2. Call POST /api/lectures/{id}/end
        res_end = await client.post(f"/api/lectures/{lecture_id}/end")
        assert res_end.status_code == 200
        assert res_end.json()["status"] == "processing"

        # 3. Run the pending job to completion
        runner = get_job_runner()
        runner._orchestrator.qdrant = isolated_qdrant
        runner._orchestrator.content_agent.qdrant = isolated_qdrant
        processed = await runner._process_next_job()
        assert processed is True

        # Verify lecture status is 'ready' and heatmap has chunks
        res_lec = await client.get(f"/api/lectures/{lecture_id}")
        assert res_lec.status_code == 200
        lec_json = res_lec.json()
        assert lec_json["status"] == "ready"
        assert len(lec_json["heatmap"]) > 0
        assert lec_json["peak_confusion"] > 0.0

        # 4. Assert GET /api/lectures/{id}/notes has sections and explained_simply on flagged topics
        res_notes = await client.get(f"/api/lectures/{lecture_id}/notes")
        assert res_notes.status_code == 200
        notes_json = res_notes.json()
        assert "sections" in notes_json
        assert len(notes_json["sections"]) > 0
        flagged_sections = [s for s in notes_json["sections"] if s.get("is_flagged")]
        assert len(flagged_sections) > 0
        for fs in flagged_sections:
            assert fs.get("explained_simply"), f"Flagged topic {fs.get('topic')} missing explained_simply"

        # 5. Assert GET /api/lectures/{id}/quiz has questions and 100% carry a valid citation
        res_quiz = await client.get(f"/api/lectures/{lecture_id}/quiz")
        assert res_quiz.status_code == 200
        quiz_json = res_quiz.json()
        questions = quiz_json.get("questions", [])
        assert len(questions) > 0
        for q in questions:
            assert q.get("source_chunk_index") is not None
            assert isinstance(q.get("source_text_snippet"), str)
            assert len(q["source_text_snippet"].strip()) > 0

        # 6. Assert GET /api/lectures/{id}/schedule.ics returns valid iCalendar bytes
        res_ics = await client.get(f"/api/lectures/{lecture_id}/schedule.ics")
        assert res_ics.status_code == 200
        assert "text/calendar" in res_ics.headers.get("content-type", "")
        ics_body = res_ics.content.decode("utf-8")
        assert "BEGIN:VCALENDAR" in ics_body
        assert "BEGIN:VEVENT" in ics_body

        # Also check JSON schedule endpoint
        res_sched = await client.get(f"/api/lectures/{lecture_id}/schedule")
        assert res_sched.status_code == 200
        assert len(res_sched.json()) > 0

        # 7. Assert GET /api/lectures/{id}/trace returns the 4 agent traces
        res_trace = await client.get(f"/api/lectures/{lecture_id}/trace")
        assert res_trace.status_code == 200
        traces = res_trace.json()
        assert len(traces) == 4
        agent_names = {t["agent_name"] for t in traces}
        assert agent_names == {"confusion_detector", "content_agent", "scheduler_agent", "orchestrator"}

        # 8. Verify /transcript, /related, and /flag updating Qdrant
        res_trans = await client.get(f"/api/lectures/{lecture_id}/transcript")
        assert res_trans.status_code == 200
        trans_chunks = res_trans.json()
        assert len(trans_chunks) > 0
        assert "start_ts" in trans_chunks[0] and "start_time" in trans_chunks[0]

        res_flag = await client.post(
            f"/api/lectures/{lecture_id}/flag",
            json={"chunk_index": 0, "reason": "Manual test"},
        )
        assert res_flag.status_code == 200
        assert res_flag.json()["updated_qdrant"] is True

        res_trans_after = await client.get(f"/api/lectures/{lecture_id}/transcript")
        chunk0 = next(c for c in res_trans_after.json() if c["chunk_index"] == 0)
        assert chunk0["confusion_score"] == 1.0
        assert "Manual" in chunk0["reasons"]

        res_rel = await client.get(f"/api/lectures/{lecture_id}/related")
        assert res_rel.status_code == 200
        assert isinstance(res_rel.json(), list)
