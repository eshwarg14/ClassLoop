"""Application configuration and environment settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central settings class using Pydantic Settings."""

    # --- App ---
    APP_ENV: str = Field(default="development", description="Application environment")
    APP_BASE_URL: str = Field(default="http://localhost:8080", description="Base URL of application")
    ADMIN_TOKEN: str = Field(default="change-me", description="Admin token for privileged operations")
    SECRET_KEY: str = Field(default="generate-with-make-secret", description="Key for crypto encryption")
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:8080",
        description="Comma-separated CORS origins",
    )
    DEMO_MODE: bool = Field(default=True, description="Enable demo mode with mocked services")
    PORT: int = Field(default=8080, description="Port to bind server")
    LOG_LEVEL: str = Field(default="INFO", description="Log level")

    # --- Omi ---
    OMI_WEBHOOK_SECRET: str | None = Field(default=None, description="Secret to verify Omi webhook signatures")
    OMI_API_KEY: str | None = Field(default=None, description="Omi API key")
    OMI_APP_ID: str | None = Field(default=None, description="Omi App ID")

    # --- Lyzr ---
    LYZR_API_KEY: str | None = Field(default=None, description="Lyzr API key")
    LYZR_AGENT_API_KEY: str | None = Field(default=None, description="Alias for Lyzr Agent API key")
    LYZR_BASE_URL: str | None = Field(default="https://agent-prod.studio.lyzr.ai", description="Lyzr base API URL")
    AGENT_ID: str | None = Field(default=None, description="Default Lyzr Agent ID")
    LYZR_ORCHESTRATOR_AGENT_ID: str | None = Field(default=None, description="Lyzr Orchestrator agent ID")
    LYZR_DETECTOR_AGENT_ID: str | None = Field(default=None, description="Lyzr Confusion Detector agent ID")
    LYZR_CONTENT_AGENT_ID: str | None = Field(default=None, description="Lyzr Content agent ID")
    LYZR_SCHEDULER_AGENT_ID: str | None = Field(default=None, description="Lyzr Scheduler agent ID")

    # --- Qdrant ---
    QDRANT_URL: str | None = Field(default=None, description="Remote Qdrant Cloud or Server URL")
    QDRANT_API_KEY: str | None = Field(default=None, description="Qdrant API key")
    QDRANT_PATH: str = Field(default="./data/qdrant", description="Local Qdrant persistence directory")
    QDRANT_COLLECTION: str = Field(default="org_memory", description="Qdrant collection name")
    QDRANT_COLLECTION_NAME: str | None = Field(default=None, description="Alias for Qdrant collection name")
    QDRANT_GRPC_PORT: int = Field(default=6334, description="Qdrant gRPC port")
    QDRANT_PREFER_GRPC: bool = Field(default=False, description="Whether to prefer gRPC for Qdrant")

    # --- Embeddings ---
    EMBEDDING_PROVIDER: str = Field(default="fastembed", description="Embedding provider: fastembed or openai")
    EMBEDDING_MODEL: str = Field(default="BAAI/bge-small-en-v1.5", description="Embedding model name")
    EMBEDDING_API_KEY: str | None = Field(default=None, description="API key for cloud embeddings")
    EMBEDDING_BASE_URL: str | None = Field(default=None, description="Base URL for embedding endpoints")

    # --- Storage ---
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./data/classloop.db",
        description="SQLAlchemy database connection string",
    )

    # --- Behaviour ---
    SILENCE_TIMEOUT_SECONDS: int = Field(default=90, description="Silence timeout to trigger lecture end")
    CHUNK_SECONDS: int = Field(default=45, description="Chunking window duration in seconds")
    EPHEMERAL_TTL_HOURS: int = Field(default=24, description="TTL for ephemeral lecture vectors and files")

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("DEMO_MODE", mode="before")
    @classmethod
    def validate_demo_mode(cls, v: Any) -> bool:
        if v is None:
            return True
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "t")
        return bool(v)

    @field_validator("PORT", mode="before")
    @classmethod
    def validate_port(cls, v: Any) -> int:
        if v is None or v == "":
            return 8080
        return int(v)

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_qdrant_cloud(self) -> bool:
        return bool(self.QDRANT_URL and self.QDRANT_URL.strip())

    @property
    def is_embedded_qdrant(self) -> bool:
        return not self.is_qdrant_cloud

    @property
    def embedding_dimension(self) -> int:
        model = (self.EMBEDDING_MODEL or "").lower()
        if "bge-small" in model:
            return 384
        if "bge-base" in model:
            return 768
        if "bge-large" in model:
            return 1024
        if "text-embedding-3-small" in model or "ada-002" in model:
            return 1536
        if "text-embedding-3-large" in model:
            return 3072
        # Default fallback for bge-small / fastembed
        return 384

    @model_validator(mode="after")
    def validate_system_consistency(self) -> Settings:
        if not self.LYZR_API_KEY and self.LYZR_AGENT_API_KEY:
            self.LYZR_API_KEY = self.LYZR_AGENT_API_KEY
        if not self.LYZR_AGENT_API_KEY and self.LYZR_API_KEY:
            self.LYZR_AGENT_API_KEY = self.LYZR_API_KEY

        if self.AGENT_ID:
            if not self.LYZR_ORCHESTRATOR_AGENT_ID:
                self.LYZR_ORCHESTRATOR_AGENT_ID = self.AGENT_ID
            if not self.LYZR_DETECTOR_AGENT_ID:
                self.LYZR_DETECTOR_AGENT_ID = self.AGENT_ID
            if not self.LYZR_CONTENT_AGENT_ID:
                self.LYZR_CONTENT_AGENT_ID = self.AGENT_ID
            if not self.LYZR_SCHEDULER_AGENT_ID:
                self.LYZR_SCHEDULER_AGENT_ID = self.AGENT_ID

        if self.QDRANT_COLLECTION_NAME and self.QDRANT_COLLECTION in ("lecture_chunks", ""):
            self.QDRANT_COLLECTION = self.QDRANT_COLLECTION_NAME
        elif not self.QDRANT_COLLECTION_NAME:
            self.QDRANT_COLLECTION_NAME = self.QDRANT_COLLECTION

        dim = self.embedding_dimension
        if dim <= 0:
            raise ValueError(f"Invalid embedding dimension computed: {dim}")
        return self

    def print_config_table(self) -> None:
        """Print a formatted table showing which integrations are active, mocked, or missing."""
        rows = []

        # Omi integration
        if self.DEMO_MODE:
            omi_status = "MOCKED (Demo Mode)"
        elif self.OMI_WEBHOOK_SECRET and self.OMI_API_KEY:
            omi_status = "ACTIVE"
        elif self.OMI_WEBHOOK_SECRET or self.OMI_API_KEY:
            omi_status = "PARTIAL (Missing keys)"
        else:
            omi_status = "NOT CONFIGURED"
        rows.append(("Omi Webhook/Ingestion", omi_status))

        # Lyzr integration
        lyzr_configured = bool(self.LYZR_API_KEY and self.LYZR_ORCHESTRATOR_AGENT_ID)
        if self.DEMO_MODE:
            lyzr_status = "MOCKED (Demo Mode)" if not lyzr_configured else "ACTIVE (Demo Mode Enabled)"
        elif lyzr_configured:
            lyzr_status = "ACTIVE"
        else:
            lyzr_status = "MISSING (Lyzr Agent keys missing)"
        rows.append(("Lyzr Agents", lyzr_status))

        # Qdrant integration
        if self.is_qdrant_cloud:
            qdrant_status = f"ACTIVE (Cloud: {self.QDRANT_URL})"
        else:
            qdrant_status = f"ACTIVE (Embedded: {self.QDRANT_PATH})"
        rows.append(("Qdrant Vector DB", qdrant_status))

        # Embeddings integration
        emb_status = f"ACTIVE ({self.EMBEDDING_PROVIDER} | {self.EMBEDDING_MODEL} | {self.embedding_dimension}d)"
        rows.append(("Embeddings Engine", emb_status))

        # Database integration
        db_type = "PostgreSQL" if "postgres" in self.DATABASE_URL else "SQLite"
        rows.append(("Primary Database", f"ACTIVE ({db_type})"))

        border = "+" + "-" * 26 + "+" + "-" * 42 + "+"
        header = f"| {'Integration':<24} | {'Status':<40} |"

        print("\n" + border)
        print(f"| {'ClassLoop Backend Configuration':<69} |")
        print(border)
        print(header)
        print(border)
        for name, status in rows:
            print(f"| {name:<24} | {status[:40]:<40} |")
        print(border + "\n")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton for application settings."""
    return Settings()
