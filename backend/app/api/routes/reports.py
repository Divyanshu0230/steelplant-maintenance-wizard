from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator import get_orchestrator
from app.agents.response_builder import agent_state_to_response
from app.db.database import get_db
from app.models.entities import Equipment, Report
from app.models.schemas import DiagnosisExportRequest, ReportListItem, ReportRequest, ReportSummaryStats
from app.services.pdf_service import PDFService
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])
report_service = ReportService()
pdf_service = PDFService()


def _report_item(report: Report, equipment: Optional[Equipment] = None) -> ReportListItem:
    content = report.content or {}
    risk = content.get("risk") or {}
    return ReportListItem(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        equipment_id=report.equipment_id,
        equipment_code=equipment.equipment_code if equipment else content.get("equipment_code"),
        equipment_name=equipment.name if equipment else content.get("equipment_name"),
        generated_by=report.generated_by,
        created_at=report.created_at,
        risk_level=risk.get("risk_level"),
        summary_preview=report_service.preview_from_content(content),
    )


@router.get("/summary", response_model=ReportSummaryStats)
async def reports_summary(db: Annotated[AsyncSession, Depends(get_db)]):
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    total = await db.scalar(select(func.count(Report.id))) or 0
    last_24h = await db.scalar(
        select(func.count(Report.id)).where(Report.created_at >= since_24h)
    ) or 0
    last_7d = await db.scalar(
        select(func.count(Report.id)).where(Report.created_at >= since_7d)
    ) or 0
    latest = await db.scalar(select(func.max(Report.created_at)))

    type_rows = await db.execute(
        select(Report.report_type, func.count())
        .group_by(Report.report_type)
        .order_by(desc(func.count()))
    )
    by_type = {row[0]: row[1] for row in type_rows.all()}

    eq_rows = await db.execute(
        select(Equipment.equipment_code, func.count())
        .join(Report, Report.equipment_id == Equipment.id)
        .group_by(Equipment.equipment_code)
        .order_by(desc(func.count()))
        .limit(8)
    )
    by_equipment = {row[0]: row[1] for row in eq_rows.all()}

    return ReportSummaryStats(
        total_reports=total,
        last_24_hours=last_24h,
        last_7_days=last_7d,
        by_type=by_type,
        by_equipment=by_equipment,
        latest_at=latest,
    )


@router.post("/generate")
async def generate_report(payload: ReportRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    if payload.report_type == "shift_briefing":
        report = await report_service.generate_shift_briefing(db)
        await db.commit()
        await db.refresh(report)
        return {
            "id": report.id,
            "title": report.title,
            "report_type": report.report_type,
            "content": report.content,
            "created_at": report.created_at,
        }

    raw_state = await get_orchestrator().run(
        db,
        query=f"Generate {payload.report_type} report for maintenance review",
        equipment_id=payload.equipment_id,
        equipment_code=payload.equipment_code,
    )
    state = agent_state_to_response(raw_state)
    report = await report_service.generate_from_agent_state(db, state, payload.report_type)
    await db.commit()
    await db.refresh(report)
    return {
        "id": report.id,
        "title": report.title,
        "report_type": report.report_type,
        "content": report.content,
        "created_at": report.created_at,
    }


@router.post("/shift-briefing")
async def generate_shift_briefing(db: Annotated[AsyncSession, Depends(get_db)]):
    """Quick plant-wide shift handover PDF — no agent orchestrator."""
    report = await report_service.generate_shift_briefing(db)
    await db.commit()
    await db.refresh(report)
    pdf_bytes = pdf_service.generate_report_pdf(report.title, report.content)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="Shift_Handover_Briefing.pdf"',
            "X-Report-Id": str(report.id),
        },
    )


@router.get("", response_model=list[ReportListItem])
async def list_reports(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    report_type: Optional[str] = None,
    equipment_code: Optional[str] = None,
    search: Optional[str] = None,
):
    stmt = (
        select(Report, Equipment)
        .outerjoin(Equipment, Report.equipment_id == Equipment.id)
        .order_by(desc(Report.created_at))
        .limit(limit)
    )
    if report_type:
        stmt = stmt.where(Report.report_type == report_type)
    if equipment_code:
        stmt = stmt.where(Equipment.equipment_code == equipment_code)
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Report.title.ilike(q),
                Report.report_type.ilike(q),
                Equipment.equipment_code.ilike(q),
                Equipment.name.ilike(q),
            )
        )

    result = await db.execute(stmt)
    rows = result.all()
    return [_report_item(report, equipment) for report, equipment in rows]


@router.post("/export-pdf")
async def export_diagnosis_pdf(
    payload: DiagnosisExportRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate a PDF from an existing diagnosis/chat result without re-running agents."""
    title = f"Maintenance Report — {payload.equipment_code}"
    content: dict = {
        "query": payload.answer[:500] if payload.answer else f"Diagnosis for {payload.equipment_code}",
        "equipment_code": payload.equipment_code,
        "equipment_name": payload.equipment_name,
        "diagnosis": {
            "probable_causes": payload.probable_causes,
            "confidence_score": payload.confidence_score or 0,
        },
        "predictive": {
            "failure_probability": payload.failure_probability,
            "rul_cycles": payload.rul_cycles,
        },
        "risk": {"risk_level": payload.risk_level},
        "maintenance_actions": payload.maintenance_actions,
        "spare_recommendations": payload.spare_recommendations,
        "executive_summary": payload.answer,
    }
    report = Report(
        report_type="diagnosis_export",
        title=title,
        content=content,
        generated_by="export",
    )
    db.add(report)
    await db.commit()

    pdf_bytes = pdf_service.generate_report_pdf(title, content)
    safe_code = payload.equipment_code.replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Maintenance_Report_{safe_code}.pdf"'},
    )


@router.get("/{report_id}")
async def get_report(report_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Report, Equipment)
        .outerjoin(Equipment, Report.equipment_id == Equipment.id)
        .where(Report.id == report_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    report, equipment = row
    item = _report_item(report, equipment)
    return {
        **item.model_dump(),
        "content": report.content,
    }


@router.get("/{report_id}/pdf")
async def download_report_pdf(report_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    pdf_bytes = pdf_service.generate_report_pdf(report.title, report.content)
    safe_title = report.title.replace(" ", "_").replace("/", "-")[:80]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )
