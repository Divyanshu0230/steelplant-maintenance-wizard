import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, FieldCondition, Filter, MatchValue, PointStruct, VectorParams

from app.core.config import get_settings
from app.core.logging import get_logger
from app.rag.embeddings import get_embedding_service

logger = get_logger(__name__)
settings = get_settings()


@dataclass
class RetrievedChunk:
    id: str
    text: str
    score: float
    metadata: dict[str, Any]


class VectorStore:
    _client: Optional[QdrantClient] = None

    def __init__(self) -> None:
        self.embeddings = get_embedding_service()
        if VectorStore._client is None:
            VectorStore._client = QdrantClient(path=settings.qdrant_path)
        self.client = VectorStore._client
        self.collection = settings.qdrant_collection
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        try:
            collections = [c.name for c in self.client.get_collections().collections]
        except Exception as exc:
            logger.warning("Could not list Qdrant collections: %s", exc)
            collections = []
        if self.collection not in collections:
            try:
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config=VectorParams(
                        size=self.embeddings.dimension,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info("Created Qdrant collection: %s", self.collection)
            except Exception as exc:
                if "already exists" not in str(exc).lower():
                    logger.warning("Collection setup skipped: %s", exc)

    def upsert_chunks(
        self,
        chunks: list[str],
        metadatas: list[dict[str, Any]],
        ids: Optional[list[str]] = None,
    ) -> int:
        if not chunks:
            return 0
        vectors = self.embeddings.embed(chunks)
        point_ids = ids or [str(uuid.uuid4()) for _ in chunks]
        points = [
            PointStruct(id=pid, vector=vec, payload={**meta, "text": chunk})
            for pid, vec, meta, chunk in zip(point_ids, vectors, metadatas, chunks)
        ]
        self.client.upsert(collection_name=self.collection, points=points)
        return len(points)

    def search(
        self,
        query: str,
        top_k: int = 5,
        document_type: Optional[str] = None,
        equipment_type: Optional[str] = None,
    ) -> list[RetrievedChunk]:
        vector = self.embeddings.embed_query(query)
        filters: list[FieldCondition] = []
        if document_type:
            filters.append(FieldCondition(key="document_type", match=MatchValue(value=document_type)))
        if equipment_type:
            filters.append(FieldCondition(key="equipment_type", match=MatchValue(value=equipment_type)))

        query_filter = Filter(must=filters) if filters else None
        response = self.client.query_points(
            collection_name=self.collection,
            query=vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return [
            RetrievedChunk(
                id=str(hit.id),
                text=hit.payload.get("text", "") if hit.payload else "",
                score=float(hit.score),
                metadata={k: v for k, v in (hit.payload or {}).items() if k != "text"},
            )
            for hit in response.points
        ]

    def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        equipment_type: Optional[str] = None,
    ) -> list[RetrievedChunk]:
        vector_results = self.search(query, top_k=top_k * 2, equipment_type=equipment_type)
        query_terms = set(query.lower().split())
        reranked: list[RetrievedChunk] = []
        for chunk in vector_results:
            text_terms = set(chunk.text.lower().split())
            overlap = len(query_terms & text_terms) / max(len(query_terms), 1)
            combined_score = chunk.score * 0.7 + overlap * 0.3
            reranked.append(
                RetrievedChunk(
                    id=chunk.id,
                    text=chunk.text,
                    score=combined_score,
                    metadata=chunk.metadata,
                )
            )
        reranked.sort(key=lambda c: c.score, reverse=True)
        return reranked[:top_k]

    def count(self) -> int:
        info = self.client.get_collection(self.collection)
        return info.points_count or 0


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore()
