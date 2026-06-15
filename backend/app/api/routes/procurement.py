from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entities import ProcurementRequest, SparePart, User
from app.models.schemas import ProcurementCreate, ProcurementReject, ProcurementResponse
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/procurement", tags=["procurement"])
pdf_service = PDFService()


def _enrich_response(req: ProcurementRequest, part: Optional[SparePart]) -> ProcurementResponse:
    unit_cost = part.unit_cost if part else None
    estimated = (unit_cost or 0) * req.quantity_requested if unit_cost else None
    return ProcurementResponse(
        id=req.id,
        spare_part_id=req.spare_part_id,
        equipment_id=req.equipment_id,
        quantity_requested=req.quantity_requested,
        urgency=req.urgency,
        status=req.status,
        notes=req.notes,
        created_at=req.created_at,
        part_code=part.part_code if part else None,
        part_name=part.name if part else None,
        unit_cost=unit_cost,
        lead_time_days=part.lead_time_days if part else None,
        equipment_type=part.equipment_type if part else None,
        estimated_cost=round(estimated, 2) if estimated else None,
    )


async def _parts_map(db: AsyncSession, requests: list[ProcurementRequest]) -> dict[int, SparePart]:
    part_ids = [r.spare_part_id for r in requests if r.spare_part_id]
    if not part_ids:
        return {}
    result = await db.execute(select(SparePart).where(SparePart.id.in_(part_ids)))
    return {p.id: p for p in result.scalars().all()}


@router.get("/summary")
async def procurement_summary(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(ProcurementRequest))
    requests = result.scalars().all()
    parts = await _parts_map(db, requests)

    by_status: dict[str, int] = {}
    by_urgency: dict[str, int] = {}
    pending_cost = 0.0
    critical_pending = 0

    for req in requests:
        by_status[req.status] = by_status.get(req.status, 0) + 1
        if req.status == "pending":
            by_urgency[req.urgency] = by_urgency.get(req.urgency, 0) + 1
            part = parts.get(req.spare_part_id) if req.spare_part_id else None
            if part and part.unit_cost:
                pending_cost += part.unit_cost * req.quantity_requested
            if req.urgency == "critical":
                critical_pending += 1

    return {
        "total_requests": len(requests),
        "pending": by_status.get("pending", 0),
        "approved": by_status.get("approved", 0),
        "rejected": by_status.get("rejected", 0),
        "critical_pending": critical_pending,
        "pending_estimated_cost": round(pending_cost, 2),
        "by_status": by_status,
        "by_urgency_pending": by_urgency,
    }


@router.get("", response_model=list[ProcurementResponse])
async def list_procurement(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=80, le=200),
):
    query = select(ProcurementRequest).order_by(desc(ProcurementRequest.created_at)).limit(limit)
    if status:
        query = query.where(ProcurementRequest.status == status)
    if urgency:
        query = query.where(ProcurementRequest.urgency == urgency)
    result = await db.execute(query)
    requests = result.scalars().all()
    parts_map = await _parts_map(db, requests)

    enriched = []
    for req in requests:
        part = parts_map.get(req.spare_part_id) if req.spare_part_id else None
        row = _enrich_response(req, part)
        if search:
            term = search.strip().lower()
            hay = " ".join(
                filter(
                    None,
                    [
                        str(req.id),
                        row.part_code,
                        row.part_name,
                        req.notes,
                        req.status,
                        req.urgency,
                    ],
                )
            ).lower()
            if term not in hay:
                continue
        enriched.append(row)
    return enriched


@router.post("", response_model=ProcurementResponse)
async def create_procurement(
    payload: ProcurementCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    part_result = await db.execute(select(SparePart).where(SparePart.id == payload.spare_part_id))
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Spare part not found")

    request = ProcurementRequest(
        spare_part_id=payload.spare_part_id,
        equipment_id=payload.equipment_id,
        quantity_requested=payload.quantity_requested,
        urgency=payload.urgency,
        notes=payload.notes,
        requested_by=user.id if user else None,
        status="pending",
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return _enrich_response(request, part)


@router.post("/approve-pending")
async def approve_pending_procurement(
    db: Annotated[AsyncSession, Depends(get_db)],
    urgency: Optional[str] = None,
):
    """Approve all pending requests — optionally filter by urgency (e.g. critical)."""
    query = select(ProcurementRequest).where(ProcurementRequest.status == "pending")
    if urgency:
        query = query.where(ProcurementRequest.urgency == urgency)
    result = await db.execute(query.order_by(desc(ProcurementRequest.created_at)))
    pending = result.scalars().all()
    if not pending:
        return {"approved": 0, "message": "No pending requests"}

    parts_map = await _parts_map(db, pending)
    approved = 0
    for req in pending:
        req.status = "approved"
        part = parts_map.get(req.spare_part_id) if req.spare_part_id else None
        if part:
            part.quantity_available += req.quantity_requested
        approved += 1
    await db.flush()
    return {"approved": approved, "message": f"Approved {approved} request(s) and updated stock"}


@router.patch("/{request_id}/approve", response_model=ProcurementResponse)
async def approve_procurement(
    request_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(ProcurementRequest).where(ProcurementRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve request with status '{req.status}'")
    req.status = "approved"
    part = None
    if req.spare_part_id:
        part_result = await db.execute(select(SparePart).where(SparePart.id == req.spare_part_id))
        part = part_result.scalar_one_or_none()
        if part:
            part.quantity_available += req.quantity_requested
    await db.flush()
    return _enrich_response(req, part)


@router.patch("/{request_id}/reject", response_model=ProcurementResponse)
async def reject_procurement(
    request_id: int,
    payload: ProcurementReject,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    result = await db.execute(select(ProcurementRequest).where(ProcurementRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject request with status '{req.status}'")
    req.status = "rejected"
    if payload.reason:
        suffix = f"[Rejected by {user.full_name if user else 'supervisor'}] {payload.reason}"
        req.notes = f"{req.notes}\n{suffix}".strip() if req.notes else suffix
    await db.flush()
    part = None
    if req.spare_part_id:
        part = (await db.execute(select(SparePart).where(SparePart.id == req.spare_part_id))).scalar_one_or_none()
    return _enrich_response(req, part)


@router.post("/export-pdf")
async def export_procurement_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    limit: int = Query(default=40, le=100),
):
    rows = await list_procurement(db, status=status, limit=limit)
    title = f"Procurement Report{f' — {status}' if status else ''}"
    lines = [f"Exported {len(rows)} request(s)", ""]
    for r in rows:
        lines.append(f"## Request #{r.id} · {r.status.upper()}")
        lines.append(f"**{r.part_code or 'Part'}** — {r.part_name or ''}")
        lines.append(
            f"Qty {r.quantity_requested} · {r.urgency} urgency · "
            f"{r.created_at.strftime('%Y-%m-%d %H:%M') if hasattr(r.created_at, 'strftime') else r.created_at}"
        )
        if r.estimated_cost:
            lines.append(f"Est. cost ₹{r.estimated_cost:,.0f}")
        if r.notes:
            lines.append(r.notes[:400])
        lines.append("")

    content: dict[str, Any] = {
        "equipment_code": "Procurement",
        "executive_summary": "\n".join(lines),
        "query": title,
    }
    pdf_bytes = pdf_service.generate_report_pdf(title, content)
    safe = status or "all"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Procurement_{safe}.pdf"'},
    )
