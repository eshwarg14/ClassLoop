"""Pydantic v2 schemas for agent input/output models and orchestrator traces."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class Topic(BaseModel):
    """Identified lecture topic with confusion metrics."""
    name: str
    confusion_score: float = Field(ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    chunk_indices: list[int] = Field(default_factory=list)
    summary: str = ""


class DetectorOutput(BaseModel):
    """Output from the Confusion Detector agent."""
    topics: list[Topic]
    overall_score: float = Field(ge=0.0, le=1.0)


class NoteSection(BaseModel):
    """Single section within the generated notes."""
    topic: str
    content_markdown: str
    is_flagged: bool = False
    explained_simply: str | None = None


class NotesOutput(BaseModel):
    """Output from the Content Agent: Notes."""
    title: str
    summary: str
    sections: list[NoteSection]


class QuizQuestion(BaseModel):
    """Single multiple-choice question in generated comprehension quiz."""
    question: str
    options: list[str]
    correct_index: int
    explanation: str
    source_chunk_index: int
    source_text_snippet: str


class QuizOutput(BaseModel):
    """Output from the Content Agent: Quiz."""
    title: str
    questions: list[QuizQuestion]


class RevisionEvent(BaseModel):
    """Single spaced-repetition calendar event."""
    topic: str
    date: str  # YYYY-MM-DD
    priority: str  # 'high', 'medium', 'low'
    confusion_score: float


class ScheduleOutput(BaseModel):
    """Output from the Scheduler Agent."""
    lecture_date: str
    events: list[RevisionEvent]


class CrossLectureLink(BaseModel):
    """Cross-lecture semantic relationship reference."""
    lecture_id: str
    lecture_title: str
    chunk_text: str
    similarity_score: float
    topic: str


class AskCitation(BaseModel):
    """Citation reference for grounded Q&A."""
    lecture_id: str
    lecture_title: str
    chunk_text: str = ""
    start_ts: float = 0.0
    end_ts: float = 0.0
    similarity: float = 0.0
    chunk_id: str = ""
    timestamp: float = 0.0
    text: str = ""

    @model_validator(mode="after")
    def populate_aliases(self) -> AskCitation:
        if not self.text and self.chunk_text:
            self.text = self.chunk_text
        elif not self.chunk_text and self.text:
            self.chunk_text = self.text
        if self.timestamp == 0.0 and self.start_ts:
            self.timestamp = self.start_ts
        elif self.start_ts == 0.0 and self.timestamp:
            self.start_ts = self.timestamp
        return self


class AskResponse(BaseModel):
    """Response model for student Q&A endpoint."""
    answer: str
    citations: list[AskCitation] = Field(default_factory=list)


class AgentStepResult(BaseModel):
    """Standard execution record for each agent step in the orchestrator pipeline."""
    agent_name: str
    status: str  # 'completed' | 'failed'
    output: Any = None
    latency_ms: int = 0
    error: str | None = None
