"""Deterministic mock LLM generating realistic lecture artifacts and Q&A."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

from app.core.scheduler_rules import calculate_revision_schedule


def mock_confusion_detection(chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Deterministic mock confusion detector.
    Groups chunks into topics, aggregates scores and reasons.
    """
    # Sample topic clusters based on keywords or chunk index
    topic_groups: dict[str, list[dict[str, Any]]] = {}

    for c in chunks:
        text = c.get("text", "") or c.get("texts", "")
        # Heuristic topic tagging from text
        if re.search(r"coffman|condition|mutual exclusion|hold and wait|no preemption|circular wait", text, re.I):
            topic = "Coffman Deadlock Conditions"
        elif re.search(r"banker|safety algorithm|resource allocation|matrix|available|allocation|need", text, re.I):
            topic = "Banker's Algorithm & Deadlock Avoidance"
        elif re.search(r"detection|wait-for|graph|cycle|recovery|preemption|termination", text, re.I):
            topic = "Deadlock Detection and Recovery"
        elif re.search(r"starvation|priority inversion|livelock|concurrency", text, re.I):
            topic = "Starvation and Livelock Anomalies"
        else:
            topic = "Introduction to Deadlocks & Resource Allocation"

        if topic not in topic_groups:
            topic_groups[topic] = []
        topic_groups[topic].append(c)

    topics = []
    total_score = 0.0

    for topic_name, g_chunks in topic_groups.items():
        chunk_indices = [int(c.get("chunk_index", 0)) for c in g_chunks]
        scores = [float(c.get("confusion_score", 0.0)) for c in g_chunks]
        avg_score = sum(scores) / max(1, len(scores))

        # Collect distinct reasons
        all_reasons = []
        for c in g_chunks:
            for r in c.get("reasons", []):
                if r not in all_reasons:
                    all_reasons.append(r)

        if not all_reasons:
            if avg_score > 0.5:
                all_reasons = ["Complex algorithmic state space", "Multi-resource verification inquiry"]
            else:
                all_reasons = ["Foundational introductory concepts"]

        summary = f"Discussion of {topic_name} covering {len(g_chunks)} lecture segment chunks."

        topics.append({
            "name": topic_name,
            "confusion_score": round(avg_score, 2),
            "reasons": all_reasons,
            "chunk_indices": sorted(chunk_indices),
            "summary": summary,
        })
        total_score += avg_score

    overall_score = round(total_score / max(1, len(topics)), 2)
    return {
        "topics": topics,
        "overall_score": overall_score,
    }


def mock_notes_generation(
    chunks: list[dict[str, Any]],
    topics: list[dict[str, Any]],
    lecture_title: str = "Operating Systems: Deadlock Fundamentals",
) -> dict[str, Any]:
    """
    Deterministic structured markdown notes with 'Explained simply' callouts for flagged topics.
    """
    sections = []
    for t in topics:
        topic_name = t.get("name", "Key Concept")
        score = float(t.get("confusion_score", 0.0))
        is_flagged = score >= 0.4

        explained_simply = None
        if is_flagged:
            explained_simply = (
                f"Imagine a group of dinner guests where each person has one fork and is waiting for their "
                f"neighbor's fork before eating. Nobody can eat, and nobody gives up their fork. "
                f"In computing, `{topic_name}` describes how multiple processes lock each other out "
                f"when waiting on shared resources."
            )

        content_md = (
            f"### Overview of {topic_name}\n\n"
            f"- **Core Concept**: Critical operational invariants that prevent conflicting execution states.\n"
            f"- **Mechanics**: Processes claim exclusive access to hardware locks, semaphores, or memory buffers.\n"
            f"- **Key Takeaway**: System safety requires continuous verification of resource allocation matrices.\n\n"
            f"```text\n[Process P0] ---> (Resource R1) ---> [Process P1] ---> (Resource R0)\n```\n"
        )

        sections.append({
            "topic": topic_name,
            "content_markdown": content_md,
            "is_flagged": is_flagged,
            "explained_simply": explained_simply,
        })

    summary = (
        f"Comprehensive lecture notes for **{lecture_title}**. Highlights key synchronization primitives, "
        f"four Coffman deadlock conditions, Dijkstra's Banker's Algorithm, and resolution strategies."
    )

    return {
        "title": f"Study Notes: {lecture_title}",
        "summary": summary,
        "sections": sections,
    }


def mock_quiz_generation(
    chunks: list[dict[str, Any]],
    topics: list[dict[str, Any]],
    lecture_title: str = "Operating Systems: Deadlock Fundamentals",
) -> dict[str, Any]:
    """
    Generate quiz questions proportional to confusion scores, each citing a source chunk.
    """
    questions = []

    for t in topics:
        topic_name = t.get("name", "Deadlock Concepts")
        chunk_indices = t.get("chunk_indices", [0])
        src_chunk_idx = chunk_indices[0] if chunk_indices else 0

        # Find matching chunk text
        src_snippet = "A deadlock occurs when a set of blocked processes each hold a resource..."
        for c in chunks:
            if c.get("chunk_index") == src_chunk_idx:
                src_snippet = (c.get("text") or c.get("texts", ""))[:120] + "..."
                break

        if "Coffman" in topic_name:
            questions.append({
                "question": "Which of the following is NOT one of the four necessary Coffman conditions for deadlock?",
                "options": [
                    "Mutual Exclusion",
                    "Hold and Wait",
                    "Preemptive Scheduling",
                    "Circular Wait",
                ],
                "correct_index": 2,
                "explanation": "The condition is No Preemption, meaning resources cannot be forcibly seized.",
                "source_chunk_index": src_chunk_idx,
                "source_text_snippet": src_snippet,
            })
        elif "Banker" in topic_name:
            questions.append({
                "question": "In the Banker's Algorithm, what criteria must a resource request satisfy to guarantee state safety?",
                "options": [
                    "Request <= Available and system remains in a safe execution sequence",
                    "Request <= Total resources currently allocated across all threads",
                    "The process promises to release locks within 10 milliseconds",
                    "At least two worker processes are in a waiting sleep state",
                ],
                "correct_index": 0,
                "explanation": "A request is only granted if Request <= Available and allocating it results in a safe state where all processes can eventually complete.",
                "source_chunk_index": src_chunk_idx,
                "source_text_snippet": src_snippet,
            })
        elif "Detection" in topic_name:
            questions.append({
                "question": "How is a deadlock condition detected in a single-instance resource allocation graph?",
                "options": [
                    "By measuring CPU utilization dropping to exactly zero",
                    "By detecting a directed cycle in the Wait-For Graph",
                    "By counting the total number of blocked processes exceeding three",
                    "By checking if page faults increase exponentially",
                ],
                "correct_index": 1,
                "explanation": "In single-instance resource systems, a cycle in the Wait-For Graph is both necessary and sufficient for deadlock.",
                "source_chunk_index": src_chunk_idx,
                "source_text_snippet": src_snippet,
            })
        else:
            questions.append({
                "question": f"What is the primary objective of studying {topic_name}?",
                "options": [
                    "To prevent concurrent processes from entering indefinite blocked states",
                    "To increase memory allocation speed by 50%",
                    "To eliminate the need for kernel synchronization primitives",
                    "To format raw disk blocks before mounting file systems",
                ],
                "correct_index": 0,
                "explanation": f"Understanding {topic_name} allows operating systems to safely coordinate access to shared finite resources.",
                "source_chunk_index": src_chunk_idx,
                "source_text_snippet": src_snippet,
            })

    return {
        "title": f"Comprehension Check: {lecture_title}",
        "questions": questions,
    }


def mock_schedule_generation(topics: list[dict[str, Any]], lecture_date: str | None = None) -> dict[str, Any]:
    """Generate revision schedule per rules."""
    date_val = lecture_date or date.today().isoformat()
    rule_events = calculate_revision_schedule(topics, lecture_date=date_val)
    events = [
        {
            "topic": ev.topic,
            "date": ev.date,
            "priority": ev.priority,
            "confusion_score": ev.confusion_score,
        }
        for ev in rule_events
    ]
    return {
        "lecture_date": date_val,
        "events": events,
    }


def mock_ask_answer(query: str, relevant_chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Grounded question answering with citations."""
    citations = []
    for c in relevant_chunks:
        payload = c.get("payload", {})
        citations.append({
            "lecture_id": payload.get("lecture_id", ""),
            "lecture_title": payload.get("lecture_title", "Operating Systems Lecture"),
            "chunk_text": payload.get("text") or payload.get("texts", ""),
            "start_ts": payload.get("start_ts", 0.0),
            "end_ts": payload.get("end_ts", 0.0),
            "similarity": round(c.get("score", 0.85), 3),
        })

    if not relevant_chunks:
        return {
            "answer": "I could not find specific discussion of that topic in your lecture transcripts.",
            "citations": [],
        }

    top_text = citations[0]["chunk_text"]
    answer = (
        f"Based on your lecture transcript, {query.strip().rstrip('?')} is addressed directly: "
        f"\"{top_text[:200]}...\"\n\n"
        f"The lecturer emphasizes verifying resource availability conditions and ensuring proper "
        f"synchronization ordering across processes to avoid blocked execution states."
    )

    return {
        "answer": answer,
        "citations": citations,
    }
