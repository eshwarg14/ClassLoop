"""Initial database schema for ClassLoop

Revision ID: 001_initial
Revises: None
Create Date: 2026-10-11 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Lectures table
    op.create_table(
        "lectures",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("session_id", sa.String(length=128), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_lectures_user_id", "lectures", ["user_id"])
    op.create_index("ix_lectures_status", "lectures", ["status"])
    op.create_index("ix_lectures_session_id", "lectures", ["session_id"])
    op.create_index("ix_lectures_user_status", "lectures", ["user_id", "status"])

    # 2. Jobs table
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("lecture_id", sa.String(length=64), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("lecture_id", name="uq_jobs_lecture_id"),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_lecture_id", "jobs", ["lecture_id"])
    op.create_index("ix_jobs_status_attempts", "jobs", ["status", "attempts"])

    # 3. Outputs table
    op.create_table(
        "outputs",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("lecture_id", sa.String(length=64), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("output_type", sa.String(length=32), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_outputs_lecture_id", "outputs", ["lecture_id"])
    op.create_index("ix_outputs_output_type", "outputs", ["output_type"])
    op.create_index("ix_outputs_lecture_type", "outputs", ["lecture_id", "output_type"])

    # 4. Agent traces table
    op.create_table(
        "agent_traces",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("lecture_id", sa.String(length=64), sa.ForeignKey("lectures.id", ondelete="CASCADE"), nullable=False),
        sa.Column("job_id", sa.String(length=64), nullable=True),
        sa.Column("agent_name", sa.String(length=64), nullable=False),
        sa.Column("input_hash", sa.String(length=64), nullable=True),
        sa.Column("output", sa.JSON(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_traces_lecture_id", "agent_traces", ["lecture_id"])
    op.create_index("ix_agent_traces_job_id", "agent_traces", ["job_id"])
    op.create_index("ix_agent_traces_agent_name", "agent_traces", ["agent_name"])

    # 5. Settings table
    op.create_table(
        "settings",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="ui"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("key", name="uq_settings_key"),
    )
    op.create_index("ix_settings_key", "settings", ["key"])


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_table("agent_traces")
    op.drop_table("outputs")
    op.drop_table("jobs")
    op.drop_table("lectures")
