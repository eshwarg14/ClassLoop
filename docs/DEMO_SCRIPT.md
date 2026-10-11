# ClassLoop Judge Demo Script (2-3 Minutes)

This presentation script guides you through presenting ClassLoop to judges and evaluators. The entire demo works out of the box with zero external dependencies in **Demo Mode**.

---

## Pre-Demo Setup & Verification
Open your terminal in the project directory:
```bash
# Verify environment is ready
cp .env.example .env
make setup
make build
make start
```
Open your browser to [http://localhost:8080](http://localhost:8080).

---

## Presentation Walkthrough

### Step 1: Launch & Clean Slate (0:00 - 0:20)
* **Action**: Show the running application on `http://localhost:8080`.
* **Talking Point**:
  > *"ClassLoop is an ambient AI learning assistant that bridges wearable audio hardware like Omi with multi-agent orchestration. It captures lectures silently, detects student confusion in real-time, and automatically crafts cited study materials without manual note-taking."*
* **Action**: Point out the clean initial dashboard. Run `make seed` in your terminal to preload past course history or initialize the workspace.

---

### Step 2: Real-Time Audio Replay & Confusion Detection (0:20 - 0:50)
* **Action**: In the terminal or UI, trigger the lecture replay:
  ```bash
  make replay
  ```
  Switch to the active lecture tab in the browser.
* **Observe in UI**:
  - Live transcript chunks appear seamlessly in the streaming feed via Server-Sent Events (SSE).
  - Highlight the speaker diarization tags: `lecturer` vs `student`.
* **Talking Point**:
  > *"Watch what happens around segment 8 when a student interrupts with a question, and at segment 18 when the user commands: 'mark this as confusing'. ClassLoop immediately flags that audio section with a high-severity confusion badge and marks it on the lecture timeline."*

---

### Step 3: Multi-Agent Pipeline & Handoffs (0:50 - 1:15)
* **Action**: Click **Finish Lecture** (or allow the replay to complete).
* **Observe in UI**:
  - Watch the live **Agent Pipeline** status cards dynamically advance:
    1. **Orchestrator Agent**: Managing the multi-stage execution DAG.
    2. **Detector Agent**: Analyzing cognitive load and heuristic markers.
    3. **Content Agent**: Structuring hierarchical notes and generating quizzes.
    4. **Scheduler Agent**: Computing spaced repetition intervals.
* **Talking Point**:
  > *"Unlike monolithic prompts, ClassLoop deploys specialized Lyzr agents. Each agent has an isolated responsibility, passing validated structured schemas down the line with full real-time telemetry over SSE."*

---

### Step 4: Notes with "Explained Simply" Intuition Blocks (1:15 - 1:35)
* **Action**: Open the **Notes** tab for the processed Operating Systems lecture.
* **Observe in UI**:
  - Clean hierarchical Markdown notes covering Coffman conditions, Prevention, and Avoidance.
  - Callout cards labeled **Explained Simply**: showing concrete real-world intuition (e.g. the single-track train analogy).
* **Talking Point**:
  > *"Whenever high cognitive friction or confusion is detected, the Content Agent injects an 'Explained Simply' analogy block alongside formal definitions, ensuring students grasp difficult theoretical foundations."*

---

### Step 5: Confusion-Weighted Quiz with Direct Citations (1:35 - 1:55)
* **Action**: Click over to the **Interactive Quiz** tab.
* **Observe in UI**:
  - Complete a question on Banker's Algorithm or Circular Wait.
  - Click the **Source Citation** pill next to an answer option.
* **Talking Point**:
  > *"The quiz isn't random. The questions are dynamically weighted toward the concepts the student found most confusing during the lecture. Every single answer links directly back to the exact lecture timestamp and transcript citation."*

---

### Step 6: Spaced Repetition Calendar & .ics Download (1:55 - 2:10)
* **Action**: Navigate to the **Revision Schedule** tab.
* **Observe in UI**:
  - The generated SM-2 spaced repetition timeline (Day 1, 3, 7, 14, 30).
  - Click **Download .ics Calendar** to inspect the ready-to-import calendar file for Google Calendar or Apple Calendar.
* **Talking Point**:
  > *"ClassLoop ensures long-term memory retention by automatically calculating review intervals calibrated to how challenging the material was, ready to sync with your phone's calendar."*

---

### Step 7: Cited Q&A ("Ask My Lecture") (2:10 - 2:30)
* **Action**: Open the **Ask My Lecture** search / chat box.
* **Input Query**: *"What is the difference between an unsafe state and a deadlocked state?"*
* **Observe in UI**:
  - Vector similarity retrieval against Qdrant produces a synthesized answer.
  - The answer cites segment 18: *"An unsafe state is NOT necessarily a deadlock..."* with a clickable timestamp jump.
* **Talking Point**:
  > *"Through Qdrant vector retrieval, students can ask targeted questions and receive answers strictly grounded in the professor's spoken words, eliminating AI hallucinations."*

---

### Step 8: Privacy Vault & Hard Purge (2:30 - 2:45)
* **Action**: Navigate to **Privacy Vault** in the navigation bar.
* **Observe in UI**:
  - Highlight the 24-hour ephemeral retention badge and local SQLite / Qdrant indicators.
  - Click **Delete Lecture Permanently**.
  - Notice the instant cascade purge across SQLite rows and Qdrant vector collections.
* **Talking Point**:
  > *"ClassLoop was built with student privacy as a first principle. Lectures are ephemeral by default, and a single tap permanently wipes all audio, transcripts, embeddings, and artifacts."*

---

### Step 9: Settings & Production Readiness (2:45 - 3:00)
* **Action**: Open the **Settings** page.
* **Observe in UI**:
  - Configuration status for Omi webhooks, Lyzr API keys, and Qdrant vector endpoints.
  - All secret tokens and keys are strictly masked (`--------`).
  - Active toggle indicator for Demo Mode vs Live Production mode.
* **Concluding Statement**:
  > *"ClassLoop turns passive audio from wearable devices into an active, intelligent learning loop that helps every student stay on track. Thank you!"*
