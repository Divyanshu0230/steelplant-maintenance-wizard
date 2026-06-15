from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.entities import Alert, Equipment, EquipmentHealthScore, Prediction, SparePart
from app.services.operational_service import delay_severity_score, recent_downtime_hours

router = APIRouter(prefix="/plant", tags=["plant"])


def _recommended_action(risk_level: str, health_score: float, rul_cycles: int | None) -> str:
    if risk_level == "critical" or health_score < 40:
        return "Immediate Shutdown"
    if risk_level == "high" or health_score < 55 or (rul_cycles is not None and rul_cycles < 8):
        return "Urgent — within 24h"
    if risk_level == "medium" or health_score < 70 or (rul_cycles is not None and rul_cycles < 20):
        return "Plan maintenance — 1 week"
    return "Monitor"


async def _build_priority_ranking(db: AsyncSession) -> list[dict]:
    eq_result = await db.execute(select(Equipment))
    equipment_list = eq_result.scalars().all()
    ranked = []

    for eq in equipment_list:
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at))
            .limit(1)
        )
        p = await db.execute(
            select(Prediction)
            .where(Prediction.equipment_id == eq.id)
            .order_by(desc(Prediction.created_at))
            .limit(1)
        )
        health = h.scalar_one_or_none()
        pred = p.scalar_one_or_none()
        delay_hrs = await recent_downtime_hours(db, eq.id)
        delay_sev = await delay_severity_score(db, eq.id)
        health_score = health.health_score if health else 50
        risk_level = health.risk_level if health else "medium"
        rul = pred.rul_cycles if pred else None
        score = (
            (100 - health_score)
            + ((pred.failure_probability or 0) * 50 if pred else 0)
            + delay_sev * 30
            + (4 if eq.criticality == "critical" else 2 if eq.criticality == "high" else 0)
        )
        ranked.append({
            "equipment_code": eq.equipment_code,
            "equipment_name": eq.name,
            "criticality": eq.criticality,
            "health_score": health_score,
            "risk_level": risk_level,
            "rul_cycles": rul,
            "failure_probability": pred.failure_probability if pred else None,
            "priority_score": round(score, 1),
            "delay_hours_30d": delay_hrs,
            "delay_severity_score": delay_sev,
            "recommended_action": _recommended_action(risk_level, health_score, rul),
        })

    ranked.sort(key=lambda x: x["priority_score"], reverse=True)
    return ranked


@router.get("/fleet-summary")
async def fleet_summary(db: AsyncSession = Depends(get_db)):
    """Dashboard KPI counts for fleet overview."""
    eq_result = await db.execute(select(Equipment))
    equipment_list = eq_result.scalars().all()
    total = len(equipment_list)
    healthy = warning = critical = 0

    for eq in equipment_list:
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at))
            .limit(1)
        )
        health = h.scalar_one_or_none()
        risk = (health.risk_level if health else "medium").lower()
        score = health.health_score if health else 75
        if score >= 65 and risk in ("low", "medium"):
            healthy += 1
        elif score < 45 or risk == "critical":
            critical += 1
        else:
            warning += 1

    alert_result = await db.execute(
        select(Alert).where(Alert.is_resolved.is_(False))
    )
    active_alerts = len(alert_result.scalars().all())

    return {
        "total_assets": total,
        "healthy_assets": healthy,
        "warning_assets": warning,
        "critical_assets": critical,
        "active_alerts": active_alerts,
        "data_source": "NASA C-MAPSS FD001 mapped to 5 Tata steel plant equipment units",
        "ml_models": ["Isolation Forest (anomaly)", "Gradient Boosting (RUL)"],
    }


@router.get("/command-center")
async def command_center(db: AsyncSession = Depends(get_db)):
    """Plant-level bottleneck and priority overview."""
    ranked = await _build_priority_ranking(db)

    alert_result = await db.execute(
        select(Alert).where(Alert.is_resolved.is_(False))
        .order_by(desc(Alert.created_at)).limit(20)
    )
    critical_alerts = alert_result.scalars().all()

    spare_result = await db.execute(select(SparePart))
    low_stock = [
        {"part_code": s.part_code, "name": s.name, "qty": s.quantity_available, "min": s.minimum_stock}
        for s in spare_result.scalars().all()
        if s.quantity_available < s.minimum_stock
    ]

    return {
        "plant_bottleneck": ranked[0] if ranked else None,
        "equipment_priority": ranked[:5],
        "critical_alert_count": len([a for a in critical_alerts if a.alert_level in ("high", "critical")]),
        "active_alerts": len(critical_alerts),
        "low_stock_parts": low_stock,
        "top_recommendation": ranked[0]["recommended_action"] if ranked else "All systems nominal",
    }


@router.get("/priority-ranking")
async def priority_ranking(db: AsyncSession = Depends(get_db)):
    """Full plant bottleneck table — TATA hackathon Priority page."""
    ranked = await _build_priority_ranking(db)
    spare_result = await db.execute(select(SparePart))
    spare_by_type: dict[str, list] = {}
    for s in spare_result.scalars().all():
        key = s.equipment_type or "general"
        spare_by_type.setdefault(key, []).append(s)

    for row in ranked:
        eq_result = await db.execute(
            select(Equipment).where(Equipment.equipment_code == row["equipment_code"])
        )
        eq = eq_result.scalar_one_or_none()
        parts = spare_by_type.get(eq.equipment_type if eq else "", []) if eq else []
        low = [p for p in parts if p.quantity_available < p.minimum_stock]
        row["spares_low_stock"] = len(low)
        row["spares_available"] = len(parts) - len(low)

    return {
        "ranking": ranked,
        "methodology": (
            "Composite score: (100-health) + failure_probability×50 + delay_severity×30 + criticality weight. "
            "Uses C-MAPSS ML health, operational delay logs, and spare inventory."
        ),
        "data_sources": ["C-MAPSS sensors", "ML predictions", "delay_logs.csv", "SparePart inventory"],
    }
