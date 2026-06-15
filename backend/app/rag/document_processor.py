import hashlib
import re
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


class DocumentProcessor:
    CHUNK_SIZE = 500
    CHUNK_OVERLAP = 80

    def load_text(self, file_path: Path) -> str:
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            return self._load_pdf(file_path)
        return file_path.read_text(encoding="utf-8", errors="ignore")

    def _load_pdf(self, file_path: Path) -> str:
        try:
            from pypdf import PdfReader

            reader = PdfReader(str(file_path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as exc:
            logger.warning("PDF read failed for %s: %s", file_path, exc)
            return ""

    def chunk_text(self, text: str) -> list[str]:
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(text):
            end = start + self.CHUNK_SIZE
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start += self.CHUNK_SIZE - self.CHUNK_OVERLAP
        return chunks

    def process_file(
        self,
        file_path: Path,
        document_type: str,
        equipment_type: str | None = None,
    ) -> tuple[list[str], list[dict[str, Any]], str]:
        content = self.load_text(file_path)
        content_hash = hashlib.sha256(content.encode()).hexdigest()
        chunks = self.chunk_text(content)
        metadatas = [
            {
                "source": file_path.name,
                "document_type": document_type,
                "equipment_type": equipment_type or "general",
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]
        return chunks, metadatas, content_hash

    def process_directory(self, directory: Path) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        if not directory.exists():
            return results
        for file_path in directory.rglob("*"):
            if file_path.suffix.lower() not in {".txt", ".md", ".pdf"}:
                continue
            doc_type = self._infer_document_type(file_path)
            equipment_type = self._infer_equipment_type(file_path.name)
            chunks, metadatas, content_hash = self.process_file(
                file_path, doc_type, equipment_type
            )
            results.append(
                {
                    "file_path": str(file_path),
                    "title": file_path.stem.replace("_", " ").title(),
                    "document_type": doc_type,
                    "equipment_type": equipment_type,
                    "chunks": chunks,
                    "metadatas": metadatas,
                    "content_hash": content_hash,
                }
            )
        return results

    @staticmethod
    def _infer_document_type(file_path: Path) -> str:
        name = file_path.stem.lower()
        if "sop" in name:
            return "sop"
        if "manual" in name:
            return "manual"
        if "incident" in name or "failure" in name:
            return "failure_report"
        if "maintenance" in name or "log" in name:
            return "maintenance_log"
        return "document"

    @staticmethod
    def _infer_equipment_type(filename: str) -> str:
        name = filename.lower()
        if "rolling" in name or "mill" in name:
            return "rolling_mill_motor"
        if "blast" in name or "furnace" in name or "blower" in name:
            return "blast_furnace_blower"
        if "conveyor" in name:
            return "conveyor_system"
        if "crane" in name:
            return "overhead_crane"
        return "general"
