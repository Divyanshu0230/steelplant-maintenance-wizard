from functools import lru_cache
from typing import Optional

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class EmbeddingService:
    def __init__(self) -> None:
        self._model = None
        self._dimension = 384

    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(settings.embedding_model)
                self._dimension = self._model.get_sentence_embedding_dimension()
                logger.info("Loaded embedding model: %s", settings.embedding_model)
            except Exception as exc:
                logger.warning("Embedding model unavailable, using hash fallback: %s", exc)
                self._model = "fallback"
        return self._model

    @property
    def dimension(self) -> int:
        self._load_model()
        return self._dimension

    def embed(self, texts: list[str]) -> list[list[float]]:
        model = self._load_model()
        if model == "fallback":
            return [self._hash_embed(t) for t in texts]
        vectors = model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vectors]

    def embed_query(self, text: str) -> list[float]:
        return self.embed([text])[0]

    @staticmethod
    def _hash_embed(text: str, dim: int = 384) -> list[float]:
        import hashlib

        digest = hashlib.sha256(text.encode()).digest()
        values = []
        for i in range(dim):
            values.append((digest[i % len(digest)] / 255.0) * 2 - 1)
        norm = sum(v * v for v in values) ** 0.5 or 1.0
        return [v / norm for v in values]


@lru_cache
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
