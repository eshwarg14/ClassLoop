# Integration Assumptions & Verification Matrix

This document records the architectural and operational assumptions adopted for external hardware and API integrations within ClassLoop. Because external hardware devices (such as the Omi pendant) and cloud agent platforms (such as Lyzr Agent API) may iterate on schemas, ClassLoop provides resilient adapter contracts, defensive parsers, and zero-dependency mock implementations for demo and fallback operation.

---

## 1. Omi Integration Assumptions

### 1.1 Webhook Payload Format
* **Assumption**: The Omi webhook pushes JSON payloads structured as a list of transcript segments or a single continuous chunk object with segmented speech metadata:
  ```json
  {
    "session_id": "session_demo_001",
    "segments": [
      {
        "id": "seg_001",
        "session_id": "session_demo_001",
        "text": "In a multiprogramming environment...",
        "speaker": "lecturer",
        "start": 30.0,
        "end": 58.0,
        "is_user": false
      }
    ]
  }
  ```
* **Rationale**: Wearable audio hardware streams diarized conversational snippets with relative timestamp offsets (`start`, `end`) and boolean or role flags distinguishing the wearer from external speakers.
* **Verification Status**: `TODO(verify)` in `backend/app/adapters/omi.py`  -  verify if Omi webhook sends individual segments per event or batches them into lists. ClassLoop's adapter accepts both formats polymorphically.

### 1.2 Webhook Signature & Security
* **Assumption**: Omi signs HTTP webhook requests using an `X-Omi-Signature` header calculated via HMAC-SHA256 over the raw HTTP request body with the shared secret configured in `OMI_WEBHOOK_SECRET`.
  ```
  X-Omi-Signature: sha256=<hex_digest>
  ```
* **Rationale**: Standard industry practice for webhook validation (comparable to GitHub, Stripe, Twilio).
* **Verification Status**: `TODO(verify)` in `backend/app/adapters/omi.py`  -  confirm whether the header key is `X-Omi-Signature` or `Authorization: Bearer <token>`. In `DEMO_MODE=true` or when `OMI_WEBHOOK_SECRET` is unset, signature validation passes with a warning.

### 1.3 Voice Command Detection
* **Assumption**: Student intent markers (e.g. *"ClassLoop, mark this as confusing"*, *"mark as confusing"*, *"bookmark this"*) appear within the transcribed text stream under `is_user=True` or `speaker="student"`.
* **Rationale**: Without a dedicated low-level hardware interrupt from the pendant, software-level intent detection via fuzzy text matching (Levenshtein distance / keyword scanning) provides reliable real-time bookmarking.
* **Verification Status**: `TODO(verify)` in `backend/app/services/confusion_detector.py`  -  evaluate latency and false-positive rates of real-time ASR keyword spotting compared to dedicated button tap gestures on the Omi hardware.

---

## 2. Lyzr Multi-Agent API Assumptions

### 2.1 Request Schema
* **Assumption**: Lyzr Agent API endpoints accept `POST` requests at `{LYZR_BASE_URL}/v2/agent/{agent_id}/chat/` (or `/run`) with a JSON payload including:
  ```json
  {
    "user_id": "classloop-user",
    "agent_id": "LYZR_ORCHESTRATOR_AGENT_ID",
    "message": "<PROMPT>",
    "session_id": "session_demo_001",
    "context": {
      "transcript": "...",
      "metadata": {}
    }
  }
  ```
  Authenticated via `x-api-key: {LYZR_API_KEY}` header.
* **Rationale**: Aligns with Lyzr Agent API v2 specification and agent chat completion endpoints.
* **Verification Status**: `TODO(verify)` in `backend/app/adapters/lyzr.py`  -  confirm parameter naming (`message` vs `prompt`, `agent_id` in URL path vs payload body).

### 2.2 Response Schema
* **Assumption**: The Lyzr API returns HTTP 200 with a JSON payload containing the agent response in either `response`, `text`, or `content` fields:
  ```json
  {
    "response": "...",
    "session_id": "session_demo_001",
    "status": "success"
  }
  ```
  Structured outputs (e.g. JSON-formatted quiz arrays or markdown notes) are parsed out of Markdown fenced code blocks or directly from the response string.
* **Rationale**: LLM agent endpoints often enclose JSON in backticks or return raw string values. The adapter uses a multi-stage parser (direct JSON decode $\rightarrow$ fenced regex extraction $\rightarrow$ fallback cleaning).
* **Verification Status**: `TODO(verify)` in `backend/app/adapters/lyzr.py`  -  check if Lyzr's structured JSON output mode can be enforced via schema parameters.

---

## 3. Demo Mode & Graceful Degradation

ClassLoop guarantees 100% functionality out of the box without requiring external API keys or live hardware:

* When `DEMO_MODE=true` (or when `LYZR_API_KEY` is not provided), all agent requests automatically route to built-in deterministic local mock engines:
  - **Mock Orchestrator**: Simulates staged agent handoffs with realistic processing latencies and SSE progress events.
  - **Mock Confusion Detector**: Identifies explicit student flags and semantic hesitation patterns based on Coffman deadlock lecture criteria.
  - **Mock Content Agent**: Produces comprehensive markdown notes with "Explained simply" intuition blocks and 5 interactive quiz questions.
  - **Mock Scheduler**: Generates an SM-2 spaced repetition calendar with valid RFC 5545 `.ics` payload.
* When `OMI_API_KEY` is absent, the replay utility (`python scripts/replay_transcript.py`) simulates live hardware audio feeds by streaming chunks into the webhook endpoint at configurable speeds.

---

## 4. Verification Action Items Summary

| Component | Target File | Verification Item | Status / Fallback |
| :--- | :--- | :--- | :--- |
| **Omi Webhook** | `backend/app/adapters/omi.py` | Verify segment schema and batching behavior | `TODO(verify)`  -  Polymorphic segment deserializer active |
| **Omi Signature** | `backend/app/adapters/omi.py` | Verify HMAC header name and algorithm | `TODO(verify)`  -  Bypassed in `DEMO_MODE=true` |
| **Voice Triggers** | `backend/app/services/confusion_detector.py` | Tune fuzzy matching thresholds for ASR noise | `TODO(verify)`  -  RegEx and keyword fallback active |
| **Lyzr API Route** | `backend/app/adapters/lyzr.py` | Verify Agent v2 endpoint URI path | `TODO(verify)`  -  Mock runner intercepts if key is missing |
| **Lyzr JSON Output**| `backend/app/adapters/lyzr.py` | Verify strict JSON response structure | `TODO(verify)`  -  Markdown JSON code block extractor active |
