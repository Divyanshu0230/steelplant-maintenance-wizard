from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.entities import Equipment, EquipmentHealthScore, Prediction, ProcurementRequest, SparePart
from app.models.schemas import (
    SparePartCreate,
    SparePartRequestCreate,
    SparePartResponse,
    SparePartUpdate,
)

router = APIRouter(prefix="/spare-parts", tags=["spare-parts"])


def _stock_status(part: SparePart) -> str:
    if part.quantity_available <= 0:
        return "out_of_stock"
    if part.quantity_available < part.minimum_stock:
        return "low_stock"
    return "healthy"


def _recommend_qty(part: SparePart) -> int:
    return max(1, part.minimum_stock - part.quantity_available + 1)


@router.get("/summary")
async def spare_parts_summary(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(SparePart))
    parts = result.scalars().all()
    low = [p for p in parts if p.quantity_available < p.minimum_stock]
    out = [p for p in parts if p.quantity_available <= 0]
    by_type: dict[str, dict[str, int]] = {}
    for p in parts:
        key = p.equipment_type or "general"
        bucket = by_type.setdefault(key, {"total": 0, "low": 0, "out": 0})
        bucket["total"] += 1
        if p.quantity_available <= 0:
            bucket["out"] += 1
        elif p.quantity_available < p.minimum_stock:
            bucket["low"] += 1

    inventory_value = sum((p.unit_cost or 0) * p.quantity_available for p in parts)
    pending = await db.scalar(
        select(func.count()).select_from(ProcurementRequest).where(ProcurementRequest.status == "pending")
    ) or 0

    return {
        "total_parts": len(parts),
        "low_stock_count": len(low),
        "out_of_stock_count": len(out),
        "healthy_count": len(parts) - len(low),
        "inventory_value": round(inventory_value, 2),
        "pending_procurement": pending,
        "by_equipment_type": by_type,
        "critical_parts": [
            {
                "part_code": p.part_code,
                "name": p.name,
                "quantity_available": p.quantity_available,
                "minimum_stock": p.minimum_stock,
                "equipment_type": p.equipment_type,
            }
            for p in sorted(low, key=lambda x: x.quantity_available)[:8]
        ],
    }


@router.get("/recommendations")
async def spare_recommendations(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: Optional[str] = None,
):
    """AI-style spare recommendations based on equipment risk and stock levels."""
    equipment_type: Optional[str] = None
    risk_level = "medium"
    failure_prob = 0.0
    equipment_name: Optional[str] = None

    if equipment_code:
        eq_result = await db.execute(
            select(Equipment).where(Equipment.equipment_code == equipment_code)
        )
        equipment = eq_result.scalar_one_or_none()
        if equipment:
            equipment_type = equipment.equipment_type
            equipment_name = equipment.name
            health_result = await db.execute(
                select(EquipmentHealthScore)
                .where(EquipmentHealthScore.equipment_id == equipment.id)
                .order_by(desc(EquipmentHealthScore.computed_at))
                .limit(1)
            )
            health = health_result.scalar_one_or_none()
            if health:
                risk_level = health.risk_level or risk_level
            pred_result = await db.execute(
                select(Prediction)
                .where(Prediction.equipment_id == equipment.id)
                .order_by(desc(Prediction.created_at))
                .limit(1)
            )
            pred = pred_result.scalar_one_or_none()
            if pred and pred.failure_probability is not None:
                failure_prob = pred.failure_probability

    high_risk = risk_level in ("high", "critical") or failure_prob >= 0.5

    query = select(SparePart)
    if equipment_type:
        query = query.where(
            or_(SparePart.equipment_type == equipment_type, SparePart.equipment_type == "general")
        )
    result = await db.execute(query.order_by(SparePart.part_code))
    parts = result.scalars().all()

    recommendations: list[dict[str, Any]] = []
    for part in parts:
        status = _stock_status(part)
        stock_low = status != "healthy"
        if not high_risk and not stock_low:
            continue
        urgency = "critical" if status == "out_of_stock" else "high" if stock_low else "medium"
        if high_risk and status == "healthy":
            urgency = "medium"
        recommendations.append({
            "part_code": part.part_code,
            "part": part.name,
            "quantity_available": part.quantity_available,
            "minimum_stock": part.minimum_stock,
            "quantity_recommended": _recommend_qty(part),
            "urgency": urgency,
            "lead_time_days": part.lead_time_days,
            "unit_cost": part.unit_cost,
            "equipment_type": part.equipment_type,
            "stock_status": status,
            "rationale": (
                f"Out of stock (min {part.minimum_stock})"
                if status == "out_of_stock"
                else f"Below minimum ({part.quantity_available}/{part.minimum_stock})"
                if stock_low
                else f"Recommended for {equipment_code} — {risk_level} risk"
            ),
        })

    recommendations.sort(
        key=lambda r: (
            0 if r["urgency"] == "critical" else 1 if r["urgency"] == "high" else 2,
            r["quantity_available"],
        )
    )

    return {
        "equipment_code": equipment_code,
        "equipment_name": equipment_name,
        "equipment_type": equipment_type,
        "risk_level": risk_level,
        "failure_probability": failure_prob,
        "recommendations": recommendations[:12],
    }


@router.get("", response_model=list[SparePartResponse])
async def list_spare_parts(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_type: Optional[str] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
):
    query = select(SparePart).order_by(SparePart.part_code)
    if equipment_type:
        query = query.where(SparePart.equipment_type == equipment_type)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            SparePart.part_code.ilike(term)
            | SparePart.name.ilike(term)
            | SparePart.supplier.ilike(term)
        )
    result = await db.execute(query)
    parts = result.scalars().all()
    if low_stock_only:
        parts = [p for p in parts if p.quantity_available < p.minimum_stock]
    return parts


@router.post("", response_model=SparePartResponse)
async def create_spare_part(
    payload: SparePartCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(SparePart).where(SparePart.part_code == payload.part_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Part code already exists: {payload.part_code}")

    part = SparePart(
        part_code=payload.part_code.upper(),
        name=payload.name,
        equipment_type=payload.equipment_type,
        quantity_available=payload.quantity_available,
        minimum_stock=payload.minimum_stock,
        unit_cost=payload.unit_cost,
        supplier=payload.supplier,
        lead_time_days=payload.lead_time_days,
    )
    db.add(part)
    await db.flush()
    return part


@router.post("/request-new")
async def request_new_spare_part(
    payload: SparePartRequestCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Add a new spare part to catalog and create a procurement request in one step."""
    code = payload.part_code.upper()
    result = await db.execute(select(SparePart).where(SparePart.part_code == code))
    part = result.scalar_one_or_none()
    created_new = False

    if not part:
        part = SparePart(
            part_code=code,
            name=payload.name,
            equipment_type=payload.equipment_type,
            quantity_available=0,
            minimum_stock=payload.minimum_stock,
            unit_cost=payload.unit_cost,
            supplier=payload.supplier,
            lead_time_days=payload.lead_time_days,
        )
        db.add(part)
        await db.flush()
        created_new = True

    proc = ProcurementRequest(
        spare_part_id=part.id,
        equipment_id=payload.equipment_id,
        quantity_requested=payload.quantity_requested,
        urgency=payload.urgency,
        notes=payload.notes or f"New part request: {code} — {payload.name}",
        status="pending",
    )
    db.add(proc)
    await db.flush()

    return {
        "status": "created",
        "created_new_part": created_new,
        "spare_part": SparePartResponse.model_validate(part),
        "procurement_id": proc.id,
        "message": "New spare part added and procurement request created" if created_new
        else "Part already in catalog — procurement request created",
    }


@router.patch("/{part_id}", response_model=SparePartResponse)
async def update_spare_part(
    part_id: int,
    payload: SparePartUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(SparePart).where(SparePart.id == part_id))
    part = result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Spare part not found")
    if payload.quantity_available is not None:
        part.quantity_available = payload.quantity_available
    if payload.minimum_stock is not None:
        part.minimum_stock = payload.minimum_stock
    await db.flush()
    return part
