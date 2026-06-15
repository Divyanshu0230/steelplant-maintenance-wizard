from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.entities import Document
from app.rag.document_processor import DocumentProcessor
from app.rag.vector_store import RetrievedChunk, get_vector_store

settings = get_settings()


class KnowledgeEngine:
    def __init__(self) -> None:
        self.processor = DocumentProcessor()
        self.vector_store = get_vector_store()

    async def ingest_directory(self, db: AsyncSession, directory: Optional[Path] = None) -> dict[str, Any]:
        target = directory or settings.documents_dir
        processed = self.processor.process_directory(target)
        total_chunks = 0
        for doc in processed:
            count = self.vector_store.upsert_chunks(doc["chunks"], doc["metadatas"])
            total_chunks += count
            existing = await db.execute(
                select(Document).where(Document.file_path == doc["file_path"])
            )
            record = existing.scalar_one_or_none()
            if record:
                record.chunk_count = count
                record.content_hash = doc["content_hash"]
            else:
                db.add(
                    Document(
                        title=doc["title"],
                        document_type=doc["document_type"],
                        equipment_type=doc["equipment_type"],
                        file_path=doc["file_path"],
                        content_hash=doc["content_hash"],
                        chunk_count=count,
                    )
                )
        await db.flush()
        return {"documents": len(processed), "chunks": total_chunks}

    async def ingest_file(
        self,
        db: AsyncSession,
        file_path: Path,
        document_type: Optional[str] = None,
        equipment_type: Optional[str] = None,
    ) -> dict[str, Any]:
        """Ingest a single uploaded file into the vector index."""
        if not file_path.exists():
            raise FileNotFoundError(str(file_path))

        doc_type = document_type or self.processor._infer_document_type(file_path)
        equip = equipment_type or self.processor._infer_equipment_type(file_path.name)
        chunks, metadatas, content_hash = self.processor.process_file(file_path, doc_type, equip)

        if not chunks:
            return {
                "status": "empty",
                "filename": file_path.name,
                "message": "No text could be extracted from this file.",
                "chunks_created": 0,
            }

        count = self.vector_store.upsert_chunks(chunks, metadatas)
        file_path_str = str(file_path)
        title = file_path.stem.replace("_", " ").title()

        existing = await db.execute(select(Document).where(Document.file_path == file_path_str))
        record = existing.scalar_one_or_none()
        if record:
            record.chunk_count = count
            record.content_hash = content_hash
            record.title = title
            record.document_type = doc_type
            record.equipment_type = equip
        else:
            record = Document(
                title=title,
                document_type=doc_type,
                equipment_type=equip,
                file_path=file_path_str,
                content_hash=content_hash,
                chunk_count=count,
            )
            db.add(record)
        await db.flush()
        await db.refresh(record)

        return {
            "status": "success",
            "document_id": record.id,
            "title": record.title,
            "filename": file_path.name,
            "document_type": doc_type,
            "equipment_type": equip,
            "chunks_created": count,
        }

    def retrieve(
        self,
        query: str,
        equipment_type: Optional[str] = None,
        top_k: int = 5,
    ) -> list[RetrievedChunk]:
        return self.vector_store.hybrid_search(query, top_k=top_k, equipment_type=equipment_type)

    def format_context(self, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "No relevant documentation found."
        parts = []
        for i, chunk in enumerate(chunks, 1):
            source = chunk.metadata.get("source", "unknown")
            doc_type = chunk.metadata.get("document_type", "document")
            parts.append(f"[{i}] ({doc_type}: {source})\n{chunk.text}")
        return "\n\n".join(parts)


@lru_cache
def get_knowledge_engine() -> KnowledgeEngine:
    return KnowledgeEngine()
