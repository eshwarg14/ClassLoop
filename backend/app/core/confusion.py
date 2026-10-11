"""Confusion scorer implementing signal detection and scoring heuristics."""

from __future__ import annotations

import math
import re

from app.core.chunker import Chunk

# Configurable weights per PRD
DEFAULT_WEIGHTS = {
    "manual_flag": 1.0,        # Manual flag override
    "student_question": 0.35,  # Question patterns or is_user=true
    "lecturer_rephrase": 0.25, # "in other words", "let me say that again" + similarity
    "check_in_phrase": 0.15,   # "does that make sense?", "any doubts?"
    "pace_drop": 0.15,         # Words per second below baseline or long gaps
    "concept_density": 0.10,   # Concept density heuristic / LLM judge placeholder
}

CONFUSION_TRIGGER_PHRASES = [
    r"mark\s+this\s+as\s+confusing",
    r"i('?m|\s+am)\s+confused",
    r"i\s+don'?t\s+understand",
    r"please\s+explain\s+(this\s+)?again",
    r"can\s+you\s+repeat\s+that",
    r"flag\s+(this|confusion)",
]

QUESTION_PATTERNS = [
    r"\?",
    r"\b(why|how|what if|could you clarify|can you clarify|does this mean)\b",
]

REPHRASE_PATTERNS = [
    r"\bin other words\b",
    r"\blet me say that again\b",
    r"\bto put it another way\b",
    r"\bput differently\b",
    r"\bwhat i mean is\b",
    r"\bwhat this means is\b",
    r"\blet me rephrase\b",
]

CHECKIN_PATTERNS = [
    r"\bdoes that make sense\b",
    r"\bany questions\b",
    r"\bany doubts\b",
    r"\beveryone following\b",
    r"\bare you with me\b",
    r"\bis that clear\b",
    r"\bmake sense\b",
]

# Baseline speech pace: normal speech is ~2.2 - 2.8 words/second (130-170 wpm)
BASELINE_WORDS_PER_SECOND = 2.0


def is_manual_confusion_flag(text: str) -> bool:
    """Check if the text contains a manual confusion trigger phrase (voice command / manual flag)."""
    text_lower = text.lower()
    for pat in CONFUSION_TRIGGER_PHRASES:
        if re.search(pat, text_lower):
            return True
    return False


def score_confusion(
    chunk: Chunk,
    prev_chunk: Chunk | None = None,
    prev_embedding: list[float] | None = None,
    curr_embedding: list[float] | None = None,
    weights: dict[str, float] | None = None,
    manual_override: bool = False,
) -> tuple[float, list[str]]:
    """
    Score confusion on a chunk using multi-signal heuristics.
    Returns: (confusion_score: float in [0.0, 1.0], reasons: List[str])
    """
    w = dict(DEFAULT_WEIGHTS)
    if weights:
        w.update(weights)

    text = chunk.texts
    text_lower = text.lower()
    reasons: list[str] = []

    # 1. Manual flag (fuzzy match or direct boolean override)
    if manual_override or is_manual_confusion_flag(text):
        return 1.0, ["Manual confusion flag triggered"]

    raw_score = 0.0

    # 2. Student question
    is_question = False
    if chunk.speaker.lower() in ("student", "user"):
        is_question = True
    else:
        for pat in QUESTION_PATTERNS:
            if re.search(pat, text_lower):
                is_question = True
                break

    if is_question:
        raw_score += w["student_question"]
        reasons.append("Student question or clarification inquiry detected")

    # 3. Lecturer rephrase
    has_rephrase_phrase = any(re.search(pat, text_lower) for pat in REPHRASE_PATTERNS)
    if has_rephrase_phrase:
        # Check similarity if embeddings are provided
        if prev_embedding and curr_embedding:
            dot = sum(a * b for a, b in zip(prev_embedding, curr_embedding, strict=False))
            norm_a = math.sqrt(sum(a * a for a in prev_embedding)) or 1.0
            norm_b = math.sqrt(sum(b * b for b in curr_embedding)) or 1.0
            sim = dot / (norm_a * norm_b)
            # High semantic similarity between consecutive chunks reinforces rephrase
            rephrase_weight = w["lecturer_rephrase"] * (0.8 if sim > 0.6 else 0.5)
        else:
            rephrase_weight = w["lecturer_rephrase"]

        raw_score += rephrase_weight
        reasons.append("Lecturer rephrase or simplification marker detected")

    # 4. Check-in phrase
    has_checkin = any(re.search(pat, text_lower) for pat in CHECKIN_PATTERNS)
    if has_checkin:
        raw_score += w["check_in_phrase"]
        reasons.append("Lecturer comprehension check-in detected")

    # 5. Pace drop / hesitation
    duration = max(0.5, chunk.end_ts - chunk.start_ts)
    word_count = len(text.split())
    wps = word_count / duration

    # Pace drop: slow pace indicates difficult concept or pause for thought
    if wps < (BASELINE_WORDS_PER_SECOND * 0.6) and word_count > 5:
        raw_score += w["pace_drop"]
        reasons.append(f"Significant speech pace drop detected ({wps:.1f} words/sec)")
    elif prev_chunk and (chunk.start_ts - prev_chunk.end_ts) > 4.0:
        raw_score += w["pace_drop"] * 0.7
        reasons.append("Long silent pause (>4s) before chunk")

    # 6. Concept density heuristic (technical terms, acronyms, definitions)
    tech_patterns = [r"\b(algorithm|deadlock|mutex|semaphore|asynchronous|protocol|invariant|theorem)\b"]
    tech_matches = sum(len(re.findall(p, text_lower)) for p in tech_patterns)
    if tech_matches >= 2:
        raw_score += w["concept_density"]
        reasons.append(f"High technical concept density ({tech_matches} keywords)")

    final_score = round(min(1.0, max(0.0, raw_score)), 2)
    return final_score, reasons
