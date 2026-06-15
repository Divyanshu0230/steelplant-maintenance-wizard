from datetime import datetime, timezone
from pathlib import Path
import re
import time
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.core.config import get_settings
from app.models.entities import Document, Report, User
from app.rag.document_processor import DocumentProcessor
from app.rag.knowledge_engine import get_knowledge_engine
from app.services.knowledge_answer import dedupe_citations

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

ALLOWED_UPLOAD_SUFFIXES = {".pdf", ".md", ".txt"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("/upload")
async def upload_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    document_type: Optional[str] = Form(None),
    equipment_type: Optional[str] = Form(None),
):
    """Upload a manual/SOP PDF (or .md/.txt), save to documents dir, and index for RAG."""
    filename = file.filename or "document.pdf"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_SUFFIXES))}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 15 MB)")

    settings = get_settings()
    uploads_dir = settings.documents_dir / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = re.sub(r"[^\w.\-]", "_", filename)
    dest = uploads_dir / safe_name
    if dest.exists():
        dest = uploads_dir / f"{dest.stem}_{int(time.time())}{dest.suffix}"

    dest.write_bytes(content)

    result = await get_knowledge_engine().ingest_file(
        db,
        dest,
        document_type=document_type,
        equipment_type=equipment_type,
    )
    if result.get("status") == "empty":
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=result.get("message", "Could not extract text"))

    return {
        "status": "success",
        **result,
    }


class KnowledgeAIAnswerRequest(BaseModel):
    question: str = Field(..., min_length=3)
    equipment_type: Optional[str] = None
    role: Optional[str] = Field(default=None, description="Filter answer depth by role: operator, engineer, manager")


class KnowledgeAIAnswerResponse(BaseModel):
    answer: str
    citations: list[dict[str, Any]]
    domain_model_active: bool
    role_context: Optional[str] = None
    ai_mode: str = "agentic"
    sources_matched: int = 0


class KnowledgeSaveRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    answer: str = Field(..., min_length=10, max_length=8000)
    citations: list[dict[str, Any]] = Field(default_factory=list)
    role: Optional[str] = None
    view_mode: str = Field(default="ai", description="ai or search")


class SavedKnowledgeAnswer(BaseModel):
    id: int
    question: str
    answer: str
    citations: list[dict[str, Any]]
    role: Optional[str] = None
    view_mode: str
    saved_at: str
    saved_by: Optional[str] = None
    source_documents: list[str] = Field(default_factory=list)


@router.post("/saved", response_model=SavedKnowledgeAnswer)
async def save_knowledge_answer(
    payload: KnowledgeSaveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    """Bookmark a useful knowledge search or AI answer for later reference."""
    saved_at = datetime.now(timezone.utc).isoformat()
    sources = list(
        dict.fromkeys(
            str(c.get("source", "")).strip()
            for c in payload.citations
            if c.get("source")
        )
    )
    report = Report(
        report_type="knowledge_saved",
        title=f"Knowledge: {payload.question[:120]}",
        content={
            "question": payload.question,
            "answer": payload.answer,
            "citations": payload.citations[:12],
            "role": payload.role,
            "view_mode": payload.view_mode,
            "saved_at": saved_at,
            "source_documents": sources,
        },
        generated_by=user.full_name if user else "Maintenance Wizard",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return SavedKnowledgeAnswer(
        id=report.id,
        question=payload.question,
        answer=payload.answer,
        citations=payload.citations,
        role=payload.role,
        view_mode=payload.view_mode,
        saved_at=saved_at,
        saved_by=report.generated_by,
        source_documents=sources,
    )


@router.get("/saved", response_model=list[SavedKnowledgeAnswer])
async def list_saved_knowledge(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 30,
):
    result = await db.execute(
        select(Report)
        .where(Report.report_type == "knowledge_saved")
        .order_by(desc(Report.created_at))
        .limit(min(limit, 100))
    )
    rows = result.scalars().all()
    out: list[SavedKnowledgeAnswer] = []
    for row in rows:
        content = row.content or {}
        out.append(
            SavedKnowledgeAnswer(
                id=row.id,
                question=str(content.get("question", row.title)),
                answer=str(content.get("answer", "")),
                citations=content.get("citations", []),
                role=content.get("role"),
                view_mode=str(content.get("view_mode", "ai")),
                saved_at=str(content.get("saved_at", row.created_at.isoformat())),
                saved_by=row.generated_by,
                source_documents=content.get("source_documents", []),
            )
        )
    return out


@router.delete("/saved/{saved_id}")
async def delete_saved_knowledge(
    saved_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Report).where(Report.id == saved_id, Report.report_type == "knowledge_saved")
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Saved answer not found")
    await db.delete(row)
    await db.flush()
    return {"status": "deleted", "id": saved_id}


@router.post("/ai-answer", response_model=KnowledgeAIAnswerResponse)
async def knowledge_ai_answer(payload: KnowledgeAIAnswerRequest):
    """Structured KB answer — RAG retrieval + optional LLM synthesis + domain SLM."""
    engine = get_knowledge_engine()
    chunks = engine.retrieve(
        payload.question,
        equipment_type=payload.equipment_type,
        top_k=6,
    )
    citations = dedupe_citations(chunks)

    from app.ml.steel_domain_slm import get_steel_domain_slm
    from app.services.knowledge_answer import (
        build_llm_prompt,
        build_llm_system,
        format_excerpts_for_llm,
        format_offline_answer,
    )
    from app.services.llm_service import get_last_ai_mode, get_llm_service

    domain = get_steel_domain_slm().analyze(
        query=payload.question,
        equipment_type=payload.equipment_type,
    )

    role = (payload.role or "engineer").lower()
    excerpts = format_excerpts_for_llm(chunks)
    ai_mode = "agentic"

    try:
        answer = await get_llm_service().generate(
            build_llm_prompt(
                question=payload.question,
                excerpts=excerpts,
                domain_context=domain.prompt_context,
                role=role,
            ),
            build_llm_system(role),
        )
        mode = get_last_ai_mode()
        ai_mode = mode if mode not in ("unknown", "offline", "enhanced_offline") else "agentic"
    except Exception:
        answer = format_offline_answer(
            question=payload.question,
            citations=citations,
            domain_context=domain.prompt_context,
            role=role,
        )

    return KnowledgeAIAnswerResponse(
        answer=answer.strip(),
        citations=citations,
        domain_model_active=domain.active,
        role_context=role or None,
        ai_mode=ai_mode,
        sources_matched=len(citations),
    )


@router.post("/ingest")
async def ingest_documents(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await get_knowledge_engine().ingest_directory(db)
    return {
        "status": "success",
        "documents_ingested": result.get("documents", 0),
        "chunks_created": result.get("chunks", 0),
        **result,
    }


async def _document_content(doc: Document) -> dict:
    if not doc.file_path:
        raise HTTPException(status_code=404, detail="Document file path not set")
    path = Path(doc.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Source file missing on disk")
    content = DocumentProcessor().load_text(path)
    return {
        "id": doc.id,
        "title": doc.title,
        "document_type": doc.document_type,
        "equipment_type": doc.equipment_type,
        "file_path": doc.file_path,
        "source_filename": path.name,
        "chunk_count": doc.chunk_count,
        "content": content,
    }


@router.get("/documents/{document_id}")
async def get_document(
    document_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return await _document_content(doc)


@router.get("/documents/by-source/{source_name}")
async def get_document_by_source(
    source_name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Document))
    docs = result.scalars().all()
    match = next(
        (d for d in docs if d.file_path and Path(d.file_path).name == source_name),
        None,
    )
    if not match:
        raise HTTPException(status_code=404, detail=f"Document not found: {source_name}")
    return await _document_content(match)


@router.get("/search")
async def search_knowledge(query: str, equipment_type: str | None = None, top_k: int = 5):
    chunks = get_knowledge_engine().retrieve(query, equipment_type=equipment_type, top_k=top_k)
    citations = dedupe_citations(chunks)
    if citations:
        return [
            {
                "text": c["excerpt"],
                "score": c["relevance_score"],
                "metadata": {
                    "source": c["source"],
                    "document_type": c["document_type"],
                },
            }
            for c in citations
        ]
    return [
        {
            "text": c.text,
            "score": c.score,
            "metadata": c.metadata,
        }
        for c in chunks
    ]


@router.get("/documents")
async def list_documents(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Document).order_by(Document.title))
    docs = result.scalars().all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "document_type": d.document_type,
            "equipment_type": d.equipment_type,
            "chunk_count": d.chunk_count,
        }
        for d in docs
    ]
