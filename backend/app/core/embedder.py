"""Embedding service supporting fastembed and OpenAI-compatible providers."""

from __future__ import annotations

import threading

import httpx

from app.config import get_settings
from app.logging import get_logger

logger = get_logger("classloop.embedder")


class EmbeddingService:
    """
    Thread-safe singleton embedding service supporting fastembed and OpenAI-compatible APIs.
    """
    _instance: EmbeddingService | None = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self.settings = get_settings()
        self._fastembed_model = None
        self._fastembed_lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> EmbeddingService:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _get_fastembed_model(self):
        """Lazy load fastembed model."""
        if self._fastembed_model is None:
            with self._fastembed_lock:
                if self._fastembed_model is None:
                    logger.info("loading_fastembed_model", model_name=self.settings.EMBEDDING_MODEL)
                    try:
                        from fastembed import TextEmbedding
                        self._fastembed_model = TextEmbedding(model_name=self.settings.EMBEDDING_MODEL)
                        logger.info("fastembed_model_loaded", model_name=self.settings.EMBEDDING_MODEL)
                    except Exception as exc:
                        logger.error("fastembed_init_failed", error=str(exc))
                        raise
        return self._fastembed_model

    def _embed_fastembed(self, texts: list[str]) -> list[list[float]]:
        model = self._get_fastembed_model()
        embeddings_gen = model.embed(texts)
        return [embedding.tolist() for embedding in embeddings_gen]

    def _embed_openai(self, texts: list[str]) -> list[list[float]]:
        """Synchronously/httpx call to OpenAI-compatible embedding API."""
        base_url = self.settings.EMBEDDING_BASE_URL or "https://api.openai.com/v1"
        url = f"{base_url.rstrip('/')}/embeddings"
        headers = {
            "Content-Type": "application/json",
        }
        if self.settings.EMBEDDING_API_KEY:
            headers["Authorization"] = f"Bearer {self.settings.EMBEDDING_API_KEY}"

        payload = {
            "input": texts,
            "model": self.settings.EMBEDDING_MODEL,
        }

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            # Sort items by index
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a list of texts using the configured provider."""
        if not texts:
            return []

        provider = self.settings.EMBEDDING_PROVIDER.lower()
        if provider == "openai":
            return self._embed_openai(texts)
        else:
            # Default to fastembed
            return self._embed_fastembed(texts)

    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string."""
        results = self.embed_texts([text])
        return results[0] if results else [0.0] * self.settings.embedding_dimension


# Module-level convenient helper functions
def get_embedder() -> EmbeddingService:
    return EmbeddingService.get_instance()


def embed_texts(texts: list[str]) -> list[list[float]]:
    return get_embedder().embed_texts(texts)


def embed_text(text: str) -> list[float]:
    return get_embedder().embed_text(text)
