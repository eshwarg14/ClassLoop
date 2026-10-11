"""Qdrant vector store adapter for lecture chunk embeddings and payload searches."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import get_settings
from app.logging import get_logger

logger = get_logger("classloop.qdrant")


class QdrantStore:
    """
    Qdrant vector store manager supporting embedded and cloud deployments.
    Adheres to the PRD schema:
      lecture_id, user_id, chunk_index, start_ts, end_ts, speaker,
      text, topic, confusion_score, reasons, visibility, expires_at
    """

    def __init__(self, client: QdrantClient | None = None) -> None:
        self.settings = get_settings()
        self.collection_name = self.settings.QDRANT_COLLECTION
        if client:
            self.client = client
        else:
            if self.settings.is_qdrant_cloud:
                try:
                    cloud_client = QdrantClient(
                        url=self.settings.QDRANT_URL,
                        api_key=self.settings.QDRANT_API_KEY,
                        prefer_grpc=self.settings.QDRANT_PREFER_GRPC,
                        grpc_port=self.settings.QDRANT_GRPC_PORT,
                        timeout=5.0,
                    )
                    cloud_client.get_collections()
                    self.client = cloud_client
                except Exception as exc:
                    logger.warning(
                        "qdrant_cloud_unreachable_falling_back_to_embedded",
                        url=self.settings.QDRANT_URL,
                        error=str(exc),
                    )
                    Path(self.settings.QDRANT_PATH).mkdir(parents=True, exist_ok=True)
                    self.client = QdrantClient(
                        path=self.settings.QDRANT_PATH,
                        timeout=10.0,
                    )
            else:
                Path(self.settings.QDRANT_PATH).mkdir(parents=True, exist_ok=True)
                self.client = QdrantClient(
                    path=self.settings.QDRANT_PATH,
                    timeout=10.0,
                )

        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        """Create payload indexes on lecture_id, user_id, visibility, topic if collection exists."""
        try:
            collections_res = self.client.get_collections()
            exists = any(c.name == self.collection_name for c in collections_res.collections)
            if not exists:
                dim = self.settings.embedding_dimension
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=dim,
                        distance=qmodels.Distance.COSINE,
                    ),
                )
                logger.info("qdrant_collection_created", collection=self.collection_name, dim=dim)

            # Create payload field indexes
            fields = [
                ("lecture_id", qmodels.PayloadSchemaType.KEYWORD),
                ("user_id", qmodels.PayloadSchemaType.KEYWORD),
                ("visibility", qmodels.PayloadSchemaType.KEYWORD),
                ("topic", qmodels.PayloadSchemaType.KEYWORD),
            ]
            for field_name, schema_type in fields:
                try:
                    self.client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name=field_name,
                        field_schema=schema_type,
                    )
                except Exception:
                    # Index might already exist or embedded client may ignore
                    pass
        except Exception as exc:
            logger.warning("ensure_indexes_warning", error=str(exc))

    def upsert_chunks(
        self,
        lecture_id: str,
        user_id: str,
        chunks_with_embeddings: list[dict[str, Any]],
        visibility: str = "private",
        expires_at: str | None = None,
    ) -> list[str]:
        """
        Upsert chunks with embeddings into Qdrant collection.
        chunks_with_embeddings: list of dicts with:
          - chunk_index
          - start_ts
          - end_ts
          - speaker
          - text
          - embedding: list[float]
          - topic: Optional[str]
          - confusion_score: Optional[float]
          - reasons: Optional[list[str]]
        """
        if not chunks_with_embeddings:
            return []

        points = []
        point_ids = []

        for item in chunks_with_embeddings:
            raw_id = item.get("id")
            if raw_id:
                try:
                    pt_id = str(uuid.UUID(str(raw_id)))
                except ValueError:
                    pt_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_id)))
            else:
                pt_id = str(uuid.uuid4())
            point_ids.append(pt_id)
            payload = {
                "lecture_id": lecture_id,
                "user_id": user_id,
                "chunk_index": item.get("chunk_index", 0),
                "start_ts": item.get("start_ts", 0.0),
                "end_ts": item.get("end_ts", 0.0),
                "speaker": item.get("speaker", "lecturer"),
                "text": item.get("text") or item.get("texts", ""),
                "topic": item.get("topic", "General"),
                "confusion_score": float(item.get("confusion_score", 0.0)),
                "reasons": item.get("reasons", []),
                "visibility": visibility,
                "expires_at": expires_at,
            }
            vector = item["embedding"]
            points.append(
                qmodels.PointStruct(
                    id=pt_id,
                    vector=vector,
                    payload=payload,
                )
            )

        self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )
        logger.info(
            "qdrant_chunks_upserted",
            lecture_id=lecture_id,
            count=len(points),
            visibility=visibility,
        )
        return point_ids

    def search_similar(
        self,
        query_embedding: list[float],
        user_id: str,
        limit: int = 5,
        lecture_id: str | None = None,
        visibility_filter: bool = True,
        exclude_lecture_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Search for nearest chunks. ALWAYS filters by user_id and visibility.
        """
        must_conditions: list[qmodels.Condition] = [
            qmodels.FieldCondition(
                key="user_id",
                match=qmodels.MatchValue(value=user_id),
            )
        ]

        if visibility_filter:
            # private and shared (or ephemeral if not expired)
            # Typically user can access their own private, shared, or ephemeral points
            pass

        if lecture_id:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="lecture_id",
                    match=qmodels.MatchValue(value=lecture_id),
                )
            )

        must_not_conditions: list[qmodels.Condition] = []
        if exclude_lecture_id:
            must_not_conditions.append(
                qmodels.FieldCondition(
                    key="lecture_id",
                    match=qmodels.MatchValue(value=exclude_lecture_id),
                )
            )

        qfilter = qmodels.Filter(
            must=must_conditions,
            must_not=must_not_conditions if must_not_conditions else None,
        )

        if hasattr(self.client, "query_points"):
            query_res = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                query_filter=qfilter,
                limit=limit,
                with_payload=True,
            )
            points = query_res.points
        else:
            points = self.client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                query_filter=qfilter,
                limit=limit,
            )

        now_iso = datetime.now(UTC).isoformat()
        results = []
        for hit in points:
            payload = hit.payload or {}
            if visibility_filter and payload.get("visibility") == "ephemeral":
                exp = payload.get("expires_at")
                if exp and exp <= now_iso:
                    continue
            results.append({
                "id": str(hit.id),
                "score": float(hit.score),
                "payload": payload,
            })
        return results

    def get_lecture_chunks(self, lecture_id: str, user_id: str) -> list[dict[str, Any]]:
        """Get all chunks for a lecture ordered by chunk_index."""
        scroll_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="lecture_id",
                    match=qmodels.MatchValue(value=lecture_id),
                ),
                qmodels.FieldCondition(
                    key="user_id",
                    match=qmodels.MatchValue(value=user_id),
                ),
            ]
        )

        points, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=scroll_filter,
            limit=500,
            with_payload=True,
            with_vectors=False,
        )

        # Sort by chunk_index
        sorted_points = sorted(points, key=lambda p: p.payload.get("chunk_index", 0))
        return [
            {
                "id": str(p.id),
                "payload": p.payload,
            }
            for p in sorted_points
        ]

    def flag_chunk(
        self,
        lecture_id: str,
        user_id: str,
        chunk_index: int | None = None,
        chunk_id: str | None = None,
        reason: str = "Manual",
    ) -> bool:
        """Flag a chunk in Qdrant with confusion_score=1.0 and add 'Manual' to reasons."""
        chunks = self.get_lecture_chunks(lecture_id=lecture_id, user_id=user_id)
        if not chunks:
            return False

        target = None
        if chunk_id is not None:
            for c in chunks:
                if str(c["id"]) == str(chunk_id):
                    target = c
                    break
            if target is None and str(chunk_id).startswith("chunk-"):
                try:
                    idx = int(str(chunk_id).split("-")[-1])
                    for c in chunks:
                        if c["payload"].get("chunk_index") == idx:
                            target = c
                            break
                except ValueError:
                    pass
        if target is None and chunk_index is not None:
            for c in chunks:
                if c["payload"].get("chunk_index") == chunk_index:
                    target = c
                    break
        if target is None:
            target = chunks[-1]

        reasons = list(target["payload"].get("reasons", []))
        if "Manual" not in reasons:
            reasons.append("Manual")
        if reason and reason not in reasons:
            reasons.append(reason)

        self.client.set_payload(
            collection_name=self.collection_name,
            payload={
                "confusion_score": 1.0,
                "reasons": reasons,
                "is_flagged": True,
            },
            points=[target["id"]],
        )
        return True

    def delete_lecture_points(self, lecture_id: str) -> bool:
        """Remove all points for a lecture."""
        del_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="lecture_id",
                    match=qmodels.MatchValue(value=lecture_id),
                )
            ]
        )
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=qmodels.FilterSelector(filter=del_filter),
        )
        logger.info("qdrant_lecture_points_deleted", lecture_id=lecture_id)
        return True

    def delete_user_points(self, user_id: str) -> bool:
        """Remove all points for a user."""
        del_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="user_id",
                    match=qmodels.MatchValue(value=user_id),
                )
            ]
        )
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=qmodels.FilterSelector(filter=del_filter),
        )
        logger.info("qdrant_user_points_deleted", user_id=user_id)
        return True

    def delete_point(self, point_id: str) -> bool:
        """Delete a single point by id."""
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=qmodels.PointIdsList(points=[point_id]),
        )
        return True

    def update_point_visibility(
        self,
        point_id: str,
        visibility: str,
        expires_at: str | None = None,
    ) -> bool:
        """Update visibility payload for a specific point."""
        from datetime import timedelta
        payload_update: dict[str, Any] = {"visibility": visibility}
        if visibility == "ephemeral":
            if expires_at is None:
                ttl_hours = getattr(self.settings, "EPHEMERAL_TTL_HOURS", 24)
                expires_at = (datetime.now(UTC) + timedelta(hours=ttl_hours)).isoformat()
            payload_update["expires_at"] = expires_at
        elif expires_at is not None:
            payload_update["expires_at"] = expires_at

        self.client.set_payload(
            collection_name=self.collection_name,
            payload=payload_update,
            points=[point_id],
        )
        return True

    def list_user_points(
        self, user_id: str, limit: int = 100, offset: str | None = None
    ) -> list[dict[str, Any]]:
        """List points belonging to user."""
        filter_user = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="user_id",
                    match=qmodels.MatchValue(value=user_id),
                )
            ]
        )
        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=filter_user,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return [
            {
                "id": str(p.id),
                "payload": p.payload,
            }
            for p in records
        ]

    def delete_expired_ephemeral(self) -> int:
        """Cleanup expired ephemeral points."""
        now_iso = datetime.now(UTC).isoformat()
        records, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="visibility",
                        match=qmodels.MatchValue(value="ephemeral"),
                    )
                ]
            ),
            limit=1000,
            with_payload=True,
            with_vectors=False,
        )

        expired_ids = []
        for r in records:
            exp = r.payload.get("expires_at")
            if exp and exp <= now_iso:
                expired_ids.append(r.id)

        if expired_ids:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qmodels.PointIdsList(points=expired_ids),
            )
            logger.info("qdrant_expired_ephemeral_deleted", count=len(expired_ids))

        return len(expired_ids)


_qdrant_store_instance: QdrantStore | None = None


def get_qdrant_store_adapter(client: QdrantClient | None = None) -> QdrantStore:
    global _qdrant_store_instance
    if _qdrant_store_instance is None or client is not None:
        _qdrant_store_instance = QdrantStore(client=client)
    return _qdrant_store_instance
