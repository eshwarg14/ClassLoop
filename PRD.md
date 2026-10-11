# ClassLoop: PRD and Architecture

*Autonomous lecture intelligence built on Omi, Qdrant and Lyzr. Track 1: Meeting & Lecture Intelligence. Solo entry.*

## 1. One-line pitch

ClassLoop sits through a lecture via Omi, detects the moments students likely got lost, and when the lecture ends it acts on its own: it writes confusion-weighted notes, generates a targeted quiz, builds a spaced-revision calendar, and links weak concepts to earlier lectures. Nobody has to prompt it.

## 2. Problem and users

**Problem.** Students leave lectures with gaps they cannot name. Notes are generic, quizzes are not tied to what was confusing, and revision is unplanned. Existing tools transcribe and summarise; none close the loop.

**Primary user:** a student attending lectures. **Secondary:** a lecturer who wants to see which topics caused confusion.

## 3. Goals and non-goals

**Goals**

- Fully autonomous post-lecture pipeline: trigger, analyse, generate, schedule.
- Confusion-aware outputs, so weak spots get more notes, more questions and earlier revision.
- Persistent memory across lectures (cross-lecture concept linking and Q&A).
- Privacy controls the user can see and change.
- No-Docker, single-process deployment.

**Non-goals (for this sprint)**

- Video or facial confusion detection.
- A full spaced-repetition algorithm such as SM-2.
- Multi-user classrooms, accounts and payments.

## 4. Feature list

### P0: must ship (the core loop)

1. **Live ingestion from Omi.** Transcript segments arrive via webhook and are buffered per session.
2. **Confusion detection.** Each chunk gets a score from 0 to 1 with reasons (see section 7).
3. **Voice command "mark this as confusing".** A guaranteed manual flag that always works in the demo.
4. **Auto end-of-lecture trigger.** Fires on an end-lecture command or a silence timeout. The pipeline starts with no user action.
5. **Confusion-weighted notes.** Structured notes with an extra "Explained simply" block for flagged sections.
6. **Targeted quiz.** Question count per topic is proportional to confusion; every question cites its source chunk.
7. **Revision schedule.** Day 1/3/7 plan, with high-confusion topics pulled earlier, exported as an `.ics` file.
8. **Dashboard.** Lecture timeline with confusion heatmap, notes, quiz, schedule, agent activity log.

### P1: differentiators (do these if P0 is solid)

9. **Cross-lecture linking.** Qdrant finds earlier chunks on the same concept: "You also struggled with this in Lecture 2."
10. **Ask your lectures.** Q&A grounded in retrieved chunks, with timestamp citations.
11. **Privacy controls.** Every memory has a visibility level (private, shared, ephemeral) plus per-lecture delete and "forget" that removes vectors from Qdrant.
12. **Agent trace view.** Shows each handoff (Orchestrator to Detector to Content to Scheduler) with inputs, outputs and latency. This is your "observable workflow" proof for judges.

### P2: only if time remains

13. Lecturer view with an aggregated confusion report.
14. Interactive quiz with scoring that feeds back into future revision weights.
15. Email or WhatsApp delivery of the daily revision nudge.

### Interface and settings (P0 for the demo)

- **"Observatory" design.** Calm, premium study-instrument look with dark, light and system themes, no flash on load, and a confusion colour scale (teal, amber, coral) that always pairs colour with icons and labels.
- **Live interactivity.** Real-time waveform and transcript with confusion tinting, an animated confusion meter, a "Mark as confusing" button (key `M`), and a demo replay control for hardware-free demos.
- **Pipeline view.** Animated graph of the four agents with live status, handoff pulses, latency and click-to-inspect JSON.
- **Settings console.** Manage and test every key (Omi, Lyzr, Qdrant, embeddings), behaviour options and confusion weights from the UI. Keys are encrypted at rest, masked, never returned, and protected by an admin token.
- **Polish.** Command palette (`Ctrl/Cmd+K`), keyboard shortcuts, toasts, skeleton loaders, onboarding checklist, responsive layout, AA contrast, reduced-motion support.

## 5. User flow

1. Student starts a lecture session (Omi starts streaming; the dashboard shows "Live").
2. ClassLoop buffers and scores chunks in real time; the voice command adds manual flags.
3. Lecture ends (command or silence timeout).
4. Orchestrator launches the agent pipeline automatically.
5. Within about a minute the dashboard shows notes, quiz, schedule and an `.ics` download.
6. Days later the student asks, "What did the lecturer say about X?" and gets a cited answer, plus cross-lecture links.

## 6. System architecture

```
  Omi device / app
        |  real-time transcript webhook (public HTTPS)
        v
+--------------- ONE FastAPI process (uvicorn, single worker) ---------------+
|  /webhook/omi -> verify secret -> dedupe -> in-memory session buffer         |
|  Chunker + Embedder (local fastembed) -> Qdrant upsert                       |
|  Live confusion scorer (rules + embedding signals) -> SSE event bus          |
|  End detector (voice command | manual | silence timeout)                    |
|        |  insert job row (SQLite `jobs`, one per lecture_id)                 |
|        v                                                                     |
|  Async job runner (asyncio, resumes unfinished jobs on startup)              |
|        |-> Orchestrator -> Confusion Detector -> Content -> Scheduler (Lyzr) |
|  REST + SSE: /api/lectures /api/ask /api/privacy /api/settings /api/stream   |
|  Serves the built React app from frontend/dist at "/"                        |
+---------------+------------------------------------+-------------------------+
                |                                    |
                v                                    v
   Qdrant: Cloud free tier, or                SQLite (lectures, jobs, outputs,
   embedded local mode (QDRANT_PATH)          traces, encrypted settings)
```

**Design choices**

- **No Docker, no Redis.** One process serves the API, the job runner and the built UI, so the whole system starts with one `uvicorn` command.
- **Two-stage confusion detection.** A cheap rule-based scorer runs live per chunk; an LLM judge re-scores the full lecture after it ends.
- **Database-backed queue.** The `jobs` table is the queue: the webhook returns immediately, jobs are keyed by lecture ID (retries are safe) and unfinished jobs resume on startup.
- **Qdrant is the shared memory.** Every agent reads and writes it, so state sharing is real. It runs in Cloud mode (recommended for the live demo) or embedded local mode (single process only).
- **Live UI through Server-Sent Events.** Segments, flags, agent steps and outputs stream to the browser as they happen.
- **Demo mode.** Mock Omi and Lyzr adapters let the full loop run with no keys; real adapters switch on when keys are saved.

## 7. Confusion detection design

Each chunk gets `confusion_score` in \[0, 1\] from a weighted sum of signals:

| Signal | How it is detected | Weight |
| --- | --- | --- |
| Manual flag | Voice command "mark this as confusing" | 1.0 (override) |
| Student question | Question pattern or a different speaker than the lecturer | 0.35 |
| Lecturer rephrase | Phrases such as "in other words", "let me say that again", plus embedding similarity to the previous chunk | 0.25 |
| Check-in phrase | "Does that make sense?", "any doubts?" | 0.15 |
| Pace drop or long pause | Words per second below the lecture baseline, gaps over 4s | 0.15 |
| Concept density | LLM judge rates difficulty of the chunk (post-lecture) | 0.10 |

Store `confusion_score` and a `reasons` list in the payload so the UI can explain every flag. Tune the weights on your own demo lecture.

## 8. Agent roles (Lyzr)

| Agent | Responsibility | Input | Output |
| --- | --- | --- | --- |
| **Orchestrator** | Starts and sequences the pipeline, handles retries, writes the trace | `lecture_id` | Job state, handoffs |
| **Confusion Detector** | Re-scores all chunks with an LLM judge, merges with live scores, groups chunks into topics | Chunks from Qdrant | Topic list with confusion scores |
| **Content Agent** | Writes notes (extra depth on flagged topics) and a quiz weighted by confusion; retrieves related past lectures | Topics + chunks | Notes (markdown), quiz (JSON) |
| **Scheduler** | Turns topic scores into a revision plan and `.ics` file | Topics + scores | Schedule (JSON), `.ics` |

All agents return strict JSON validated with Pydantic. Invalid output triggers one automatic retry with the validation error appended.

**Scheduling rule (simple and defensible):**

- score >= 0.7: revise on day 1, 2, 5, 10
- 0.4 to 0.7: revise on day 1, 3, 7
- below 0.4: revise on day 7 only

## 9. Data model

**Qdrant collection `lecture_chunks`** (cosine distance, dimension matching your embedding model)

```json
{
  "lecture_id": "lec_2026_10_11_os",
  "user_id": "u1",
  "chunk_index": 14,
  "start_ts": 812.4,
  "end_ts": 861.0,
  "speaker": "lecturer",
  "text": "...",
  "topic": "Deadlock prevention",
  "confusion_score": 0.82,
  "reasons": ["student_question", "rephrase"],
  "visibility": "private",
  "expires_at": null
}
```

Create payload indexes on `lecture_id`, `user_id`, `visibility` and `topic` so filtered search stays fast.

**Relational tables:** `lectures`, `jobs`, `outputs` (notes, quiz, schedule), `agent_traces` (agent, input hash, output, latency, status).

Also `settings` (key overrides saved from the UI, encrypted with Fernet derived from `SECRET_KEY`). The `jobs` table doubles as the work queue (status, attempts, error, timestamps).

## 10. API surface

| Endpoint | Purpose |
| --- | --- |
| `POST /webhook/omi` | Receive transcript segments (secret-verified, idempotent) |
| `POST /lectures/{id}/end` | Manual end trigger |
| `GET /lectures` and `GET /lectures/{id}` | List and detail, including heatmap data |
| `GET /lectures/{id}/notes`, `/quiz`, `/schedule.ics` | Generated outputs |
| `POST /ask` | Grounded Q&A with citations (supports cross-lecture) |
| `PATCH /memories/{id}/visibility` | Change a memory's visibility |
| `DELETE /lectures/{id}` | Forget: removes Qdrant points and database rows |
| `GET /lectures/{id}/trace` | Agent handoff log |
| `GET /healthz` and `/readyz` | Liveness and readiness (checks Qdrant, DB, queue) |

Additional endpoints: `GET /api/stream/{lecture_id}` (Server-Sent Events), `GET` and `PUT /api/settings` (admin token, values never returned, only set/not set and last four characters), and `POST /api/settings/test/{integration}` (live connection test with latency).

## 11. Privacy and security

- Default visibility is **private**; `ephemeral` memories carry `expires_at` and a cleanup job removes them.
- All retrieval applies a mandatory `user_id` and `visibility` filter, so no agent can read another user's private memory.
- A "What I stored" panel lists every memory with its visibility and a delete button.
- Secrets only in environment variables; webhook verified with a shared secret; CORS restricted; rate limiting on public endpoints.
- Logs never contain raw transcript text, only IDs and scores.

Keys saved in Settings are encrypted at rest, masked in the UI, excluded from logs and API responses, and gated by `ADMIN_TOKEN`; the UI warns while the default token is in use.

## 12. Production readiness

- **Reliability:** idempotent webhook, database-backed job runner with retries and exponential backoff, failed jobs surfaced in the UI with a retry button, per-job timeouts.
- **Fallbacks:** demo mode and a replay endpoint run the same pipeline without hardware or keys; keep a real Omi run as the main demo path.
- **Observability:** structured JSON logs, request IDs, per-agent latency and failure counters, an agent trace stored per job and shown live in the Pipeline view.
- **Testing:** unit tests for the scorer, scheduler and `.ics` export, schema contract tests for agent JSON, an end-to-end replay test, and a privacy test proving no cross-user leakage.
- **CI:** GitHub Actions running ruff, pytest and the frontend typecheck and build on every push (no Docker step).
- **Config:** 12-factor env vars with a `.env.example`, validated at startup, with UI overrides stored encrypted in the database.

## 13. Deployment

**Repo layout**

```
classloop/
  backend/        FastAPI app, agents, job runner, migrations, tests
  frontend/       React + Vite UI (built into frontend/dist)
  scripts/        seed_demo.py, replay_transcript.py, sample_lecture.json
  docs/           ARCHITECTURE, ASSUMPTIONS, DEMO_SCRIPT, DEPLOY
  Makefile        setup, dev, build, start, test, seed, replay
  .env.example    committed template (the real .env is gitignored)
  PRD.md
  README.md
```

**Local (no Docker):** create a Python venv, run `pip install -e backend`, then `cd frontend && npm install && npm run build`, and start everything with `uvicorn app.main:app --port 8080` (or `make setup build start`). Open `http://localhost:8080`, then run `python scripts/seed_demo.py` to load a sample lecture. For UI development run `npm run dev` beside uvicorn.

**Cloud (public URL for Omi's webhook):**

- Backend and UI: Render or Railway with the native Python runtime. Build: install backend and build the frontend. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, single instance.
- Qdrant: Qdrant Cloud free tier (set `QDRANT_URL` and `QDRANT_API_KEY`). Embedded mode (`QDRANT_PATH`) is for local use and needs a persistent disk if used in the cloud.
- SQLite on a persistent disk, or Postgres through `DATABASE_URL`.
- Local development: expose the webhook with Cloudflare Tunnel or ngrok so Omi can reach it.

**Environment variables:** `ADMIN_TOKEN`, `SECRET_KEY`, `DEMO_MODE`, `OMI_WEBHOOK_SECRET`, `OMI_API_KEY`, `LYZR_API_KEY`, Lyzr agent IDs, `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PATH`, `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `DATABASE_URL`, `SILENCE_TIMEOUT_SECONDS`. All can also be set and tested from the Settings page.

## 14. Success metrics

- End-to-end latency from lecture end to outputs under 90 seconds for a 10-minute lecture.
- At least 80% of manual and rephrase-based confusion moments flagged in your demo lecture.
- 100% of quiz questions carry a source citation.
- Zero cross-user leakage in the privacy test.

## 15. Two-day build plan (today is Oct 11, deadline Oct 13, 11:59 PM IST)

**Today (Oct 11)**

1. Repo, run scripts, FastAPI skeleton with `/healthz`.
2. Omi webhook receiving real segments (check the starter kit for the exact payload and verification method).
3. Chunking, embedding and Qdrant upsert with the payload above.
4. Live confusion scorer plus the voice command.
5. One Lyzr agent responding through the API.

**Tomorrow (Oct 12)**

1. Orchestrator plus the three downstream agents, with Pydantic validation and trace logging.
2. End-of-lecture auto-trigger.
3. Dashboard: timeline heatmap, notes, quiz, schedule, `.ics`.
4. P1 features in order: privacy panel, cross-lecture linking, Q&A.
5. Deploy to the cloud and test with real Omi input.

**Deadline day (Oct 13)**

1. Tests and CI green, README and architecture diagram.
2. Record the demo video; submit by the afternoon, leaving buffer.

## 16. Demo script (2 to 3 minutes)

1. Show the empty dashboard and say you are starting a live lecture.
2. Give a 4-minute mini-lecture on camera into Omi. Rephrase once, ask yourself a question, and say "mark this as confusing."
3. End the lecture and do nothing else. Show the agent trace lighting up as handoffs happen.
4. Open the generated notes, the quiz weighted to the flagged topics, and the calendar file.
5. Ask, "What did we cover about deadlocks?" and show the cited answer and the cross-lecture link.
6. Delete the lecture from the privacy panel and show the vectors disappear.

## 17. Submission checklist

- Public repo with a clean README and one-command setup
- Architecture diagram and agent role write-up (reuse sections 6 and 8)
- Demo video showing real Omi input and the autonomous follow-up
- Visible agent trace in the UI or logs
- Sample data and a replay script so judges can run it without hardware

## 18. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Omi payload or auth differs from assumptions | Read the starter kit first; keep the replay endpoint as a fallback |
| Lyzr agent returns malformed JSON | Pydantic validation with one retry; keep prompts strict |
| Confusion detection feels weak | Voice command guarantees flags; tune weights on your demo lecture |
| Over-scoping | Ship P0 fully before touching P1; cut P2 entirely if behind |
| Webhook not reachable | Deploy early to a public host instead of relying on a tunnel for the final demo |
| Embedded Qdrant locks to one process | Run a single uvicorn worker; use Qdrant Cloud for the live demo |

*Note: the Omi webhook fields and Lyzr agent API details above are written from general knowledge. Confirm exact payload formats and endpoints in the starter kits and integration guides on the hackathon platform before coding against them.*
