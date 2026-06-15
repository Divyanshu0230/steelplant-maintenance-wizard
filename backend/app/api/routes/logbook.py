from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entities import Equipment, MaintenanceRecord, User
from app.models.schemas import LogbookCreate, LogbookEntry
from app.services.pdf_service import PDFService
from app.services.report_service import ReportService

router = APIRouter(prefix="/logbook", tags=["logbook"])
report_service = ReportService()
pdf_service = PDFService()


def _entry_from_row(record: MaintenanceRecord, equipment: Optional[Equipment] = None) -> LogbookEntry:
    return LogbookEntry(
        id=record.id,
        equipment_id=record.equipment_id,
        equipment_code=equipment.equipment_code if equipment else None,
        equipment_name=equipment.name if equipment else None,
        maintenance_type=record.maintenance_type,
        performed_at=record.performed_at,
        performed_by=record.performed_by,
        description=record.description,
        parts_used=record.parts_used,
        duration_hours=record.duration_hours,
        cost=record.cost,
        outcome=record.outcome,
    )


async def _equipment_for_code(db: AsyncSession, equipment_code: str) -> Equipment:
    result = await db.execute(select(Equipment).where(Equipment.equipment_code == equipment_code))
    equipment = result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    return equipment


@router.get("/summary")
async def logbook_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: Optional[str] = None,
):
    """Counts for dashboard cards — feeds Live shift handover."""
    since_8h = datetime.now(timezone.utc) - timedelta(hours=8)
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    equipment_id: Optional[int] = None
    if equipment_code:
        equipment = await _equipment_for_code(db, equipment_code)
        equipment_id = equipment.id

    def _count(extra=None):
        stmt = select(func.count(MaintenanceRecord.id))
        if equipment_id:
            stmt = stmt.where(MaintenanceRecord.equipment_id == equipment_id)
        if extra is not None:
            stmt = stmt.where(extra)
        return stmt

    total = await db.scalar(_count()) or 0
    last_8h = await db.scalar(_count(MaintenanceRecord.performed_at >= since_8h)) or 0
    last_24h = await db.scalar(_count(MaintenanceRecord.performed_at >= since_24h)) or 0

    type_stmt = (
        select(MaintenanceRecord.maintenance_type, func.count())
        .group_by(MaintenanceRecord.maintenance_type)
        .order_by(desc(func.count()))
        .limit(6)
    )
    if equipment_id:
        type_stmt = type_stmt.where(MaintenanceRecord.equipment_id == equipment_id)
    type_rows = await db.execute(type_stmt)
    by_type = {row[0]: row[1] for row in type_rows.all()}

    equip_rows = await db.execute(
        select(Equipment.equipment_code, func.count())
        .join(MaintenanceRecord, MaintenanceRecord.equipment_id == Equipment.id)
        .group_by(Equipment.equipment_code)
        .order_by(desc(func.count()))
        .limit(5)
    )
    by_equipment = {row[0]: row[1] for row in equip_rows.all()}

    return {
        "total_entries": total,
        "last_8_hours": last_8h,
        "last_24_hours": last_24h,
        "by_type": by_type,
        "by_equipment": by_equipment,
    }


@router.get("", response_model=list[LogbookEntry])
async def list_logbook(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_id: Optional[int] = None,
    equipment_code: Optional[str] = None,
    maintenance_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    query = (
        select(MaintenanceRecord, Equipment)
        .join(Equipment, MaintenanceRecord.equipment_id == Equipment.id)
        .order_by(desc(MaintenanceRecord.performed_at))
        .limit(limit)
    )
    if equipment_id:
        query = query.where(MaintenanceRecord.equipment_id == equipment_id)
    elif equipment_code:
        query = query.where(Equipment.equipment_code == equipment_code)
    if maintenance_type:
        query = query.where(MaintenanceRecord.maintenance_type == maintenance_type)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            MaintenanceRecord.description.ilike(term)
            | MaintenanceRecord.parts_used.ilike(term)
            | Equipment.equipment_code.ilike(term)
        )

    result = await db.execute(query)
    return [_entry_from_row(record, equipment) for record, equipment in result.all()]


@router.post("", response_model=LogbookEntry)
async def create_logbook_entry(
    payload: LogbookCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    equipment = await _equipment_for_code(db, payload.equipment_code)

    record = await report_service.create_logbook_entry(
        db,
        equipment_id=equipment.id,
        description=payload.description,
        maintenance_type=payload.maintenance_type,
        performed_by=payload.performed_by or (user.full_name if user else "Maintenance Wizard"),
        parts_used=payload.parts_used,
        duration_hours=payload.duration_hours,
        cost=payload.cost,
        outcome=payload.outcome or "completed",
    )
    return _entry_from_row(record, equipment)


@router.post("/export-pdf")
async def export_logbook_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: Optional[str] = None,
    limit: int = Query(default=30, le=100),
):
    """Download filtered logbook entries as PDF."""
    entries = await list_logbook(
        db,
        equipment_code=equipment_code,
        limit=limit,
    )
    title = f"Maintenance Logbook{f' — {equipment_code}' if equipment_code else ''}"
    lines = [f"Exported {len(entries)} entries", ""]
    for e in entries:
        code = e.equipment_code or f"EQ-{e.equipment_id}"
        ts = e.performed_at.strftime("%Y-%m-%d %H:%M") if hasattr(e.performed_at, "strftime") else str(e.performed_at)
        lines.append(f"## {code} · {e.maintenance_type.replace('_', ' ').title()}")
        lines.append(f"**{ts}** · {e.performed_by or 'Unknown'}")
        lines.append(e.description[:800])
        if e.parts_used:
            lines.append(f"Parts: {e.parts_used}")
        if e.duration_hours is not None:
            lines.append(f"Duration: {e.duration_hours}h")
        if e.cost is not None:
            lines.append(f"Cost: ₹{e.cost:,.0f}")
        lines.append("")

    content: dict[str, Any] = {
        "equipment_code": equipment_code or "Plant-wide",
        "executive_summary": "\n".join(lines),
        "query": title,
    }
    pdf_bytes = pdf_service.generate_report_pdf(title, content)
    safe = (equipment_code or "logbook").replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Logbook_{safe}.pdf"'},
    )
