"""Live monitoring APIs — shift briefing, what-if, contagion, maintenance debt."""

from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.entities import Alert, Equipment, EquipmentHealthScore, MaintenanceRecord, Prediction, SensorData
from app.services.monitoring_events import get_events, get_last_scan

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

# Steel plant production dependency graph (unique cross-asset contagion model)
CONTAGION_GRAPH: dict[str, list[dict]] = {
    "BF-BLOWER-01": [
        {"target": "RM-MOTOR-03", "reason": "Shared compressed air to rolling mill lubrication", "boost": 0.15},
        {"target": "BF-PUMP-05", "reason": "Cooling loop dependency", "boost": 0.08},
    ],
    "BF-PUMP-05": [
        {"target": "BF-BLOWER-01", "reason": "Coolant supply to blower bearings", "boost": 0.12},
    ],
    "RM-MOTOR-03": [
        {"target": "CV-SYSTEM-12", "reason": "Drives hot-coil conveyor — motor stall stops line", "boost": 0.2},
    ],
    "CV-SYSTEM-12": [
        {"target": "OH-CRANE-02", "reason": "Coil transport backlog increases crane duty cycle", "boost": 0.1},
    ],
}

CRITICALITY_COST_PER_HOUR = {
    "critical": 850000,
    "high": 420000,
    "medium": 180000,
    "low": 75000,
}


@router.get("/status")
async def live_status(db: Annotated[AsyncSession, Depends(get_db)]):
    """Real-time monitoring heartbeat for all equipment."""
    scan = get_last_scan()
    eq_result = await db.execute(select(Equipment).order_by(Equipment.equipment_code))
    assets = []

    for eq in eq_result.scalars().all():
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
        s = await db.execute(
            select(SensorData)
            .where(SensorData.equipment_id == eq.id)
            .order_by(desc(SensorData.cycle), desc(SensorData.timestamp))
            .limit(1)
        )
        health = h.scalar_one_or_none()
        pred = p.scalar_one_or_none()
        sensor = s.scalar_one_or_none()
        meta = (sensor.metadata_ or {}) if sensor else {}

        assets.append({
            "equipment_code": eq.equipment_code,
            "equipment_name": eq.name,
            "location": eq.location,
            "health_score": health.health_score if health else 75,
            "risk_level": health.risk_level if health else "medium",
            "rul_cycles": pred.rul_cycles if pred else None,
            "failure_probability": pred.failure_probability if pred else None,
            "last_cycle": sensor.cycle if sensor else None,
            "last_reading_at": sensor.timestamp.isoformat() if sensor and sensor.timestamp else None,
            "data_source": meta.get("source", "plant_sensors"),
            "live_simulated": meta.get("live_simulated", False),
            "pulse": "critical" if (health and health.risk_level == "critical") else "active",
        })

    return {
        "monitoring_active": True,
        "scan_interval_seconds": 60,
        "last_scan": scan,
        "websocket_endpoint": "/api/v1/ws/monitoring",
        "assets": assets,
        "event_count": len(get_events(200)),
    }


@router.get("/event-feed")
async def event_feed(limit: int = Query(default=40, le=100)):
    return {"events": get_events(limit)}


@router.get("/shift-briefing")
async def shift_briefing(db: Annotated[AsyncSession, Depends(get_db)]):
    """Auto-generated shift handover — what happened since last 8 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=8)
    alerts = await db.execute(
        select(Alert).where(Alert.created_at >= cutoff).order_by(desc(Alert.created_at))
    )
    logs = await db.execute(
        select(MaintenanceRecord).where(MaintenanceRecord.performed_at >= cutoff)
        .order_by(desc(MaintenanceRecord.performed_at)).limit(10)
    )
    alert_rows = alerts.scalars().all()
    log_rows = logs.scalars().all()

    eq_result = await db.execute(select(Equipment))
    equipment = {e.id: e for e in eq_result.scalars().all()}

    critical = [a for a in alert_rows if a.alert_level in ("critical", "high")]
    briefing_lines = [
        f"Shift briefing — last 8 hours ({datetime.now(timezone.utc).strftime('%H:%M UTC')})",
        f"• {len(alert_rows)} alerts raised ({len(critical)} high/critical)",
        f"• {len(log_rows)} maintenance log entries",
    ]

    if critical:
        briefing_lines.append("Critical items requiring handover:")
        for a in critical[:5]:
            code = equipment[a.equipment_id].equipment_code if a.equipment_id and a.equipment_id in equipment else "plant"
            briefing_lines.append(f"  - [{a.alert_level.upper()}] {code}: {a.title}")

    bottleneck = None
    worst_health = 101.0
    for eq in equipment.values():
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at)).limit(1)
        )
        health = h.scalar_one_or_none()
        score = health.health_score if health else 100.0
        if score < worst_health:
            worst_health = score
            bottleneck = eq.equipment_code

    if bottleneck:
        briefing_lines.append(f"• Plant bottleneck at shift end: {bottleneck}")

    critical_alerts = []
    for a in critical[:8]:
        code = equipment[a.equipment_id].equipment_code if a.equipment_id and a.equipment_id in equipment else "plant"
        critical_alerts.append({
            "equipment_code": code,
            "level": a.alert_level,
            "title": a.title,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        "period_hours": 8,
        "summary": "\n".join(briefing_lines),
        "alert_count": len(alert_rows),
        "critical_count": len(critical),
        "logbook_entries": len(log_rows),
        "bottleneck_code": bottleneck,
        "critical_alerts": critical_alerts,
        "recommended_handover_action": (
            f"Prioritize inspection on {bottleneck} before next shift"
            if bottleneck else "Continue routine monitoring"
        ),
    }


@router.get("/what-if")
async def what_if_simulation(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: str,
    delay_days: int = Query(default=7, ge=1, le=30),
):
    """Unique: project failure risk if maintenance is delayed."""
    eq = await db.execute(select(Equipment).where(Equipment.equipment_code == equipment_code))
    equipment = eq.scalar_one_or_none()
    if not equipment:
        return {"error": "Equipment not found"}

    p = await db.execute(
        select(Prediction)
        .where(Prediction.equipment_id == equipment.id)
        .order_by(desc(Prediction.created_at)).limit(1)
    )
    pred = p.scalar_one_or_none()
    base_rul = pred.rul_cycles if pred else 50
    base_prob = pred.failure_probability if pred else 0.3

    cycles_per_day = 3
    cycles_lost = delay_days * cycles_per_day
    projected_rul = max(0, base_rul - cycles_lost)
    projected_prob = min(0.99, base_prob + (delay_days * 0.04))
    downtime_hours = delay_days * 8 if projected_rul <= 0 else 0
    cost = downtime_hours * CRITICALITY_COST_PER_HOUR.get(equipment.criticality, 180000)

    return {
        "equipment_code": equipment_code,
        "delay_days": delay_days,
        "current_rul_cycles": base_rul,
        "current_failure_probability": round(base_prob, 3),
        "projected_rul_cycles": projected_rul,
        "projected_failure_probability": round(projected_prob, 3),
        "recommendation": (
            "IMMEDIATE maintenance required — projected failure within delay window"
            if projected_rul <= 5 else
            f"Risk increases {((projected_prob - base_prob) * 100):.0f}% if delayed {delay_days} days"
        ),
        "estimated_downtime_cost_inr": cost if projected_rul <= 0 else round(cost * (projected_prob - base_prob)),
        "safe_to_delay": projected_rul > 10 and projected_prob < 0.6,
    }


@router.get("/contagion-risk")
async def contagion_risk(db: Annotated[AsyncSession, Depends(get_db)]):
    """Unique: cross-equipment failure propagation across production lines."""
    eq_result = await db.execute(select(Equipment))
    risk_by_code: dict[str, float] = {}

    for eq in eq_result.scalars().all():
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at)).limit(1)
        )
        p = await db.execute(
            select(Prediction)
            .where(Prediction.equipment_id == eq.id)
            .order_by(desc(Prediction.created_at)).limit(1)
        )
        health = h.scalar_one_or_none()
        pred = p.scalar_one_or_none()
        base = (pred.failure_probability if pred else 0.2)
        if health and health.risk_level == "critical":
            base = max(base, 0.85)
        elif health and health.risk_level == "high":
            base = max(base, 0.6)
        risk_by_code[eq.equipment_code] = base

    edges = []
    for source, targets in CONTAGION_GRAPH.items():
        source_risk = risk_by_code.get(source, 0.2)
        if source_risk < 0.5:
            continue
        for t in targets:
            propagated = min(0.95, risk_by_code.get(t["target"], 0.2) + t["boost"] * source_risk)
            edges.append({
                "from": source,
                "to": t["target"],
                "reason": t["reason"],
                "source_risk": round(source_risk, 2),
                "propagated_risk": round(propagated, 2),
                "severity": "high" if propagated >= 0.7 else "medium" if propagated >= 0.5 else "low",
            })

    return {
        "description": "Production-line contagion model — parent asset failures amplify child asset risk",
        "edges": edges,
        "highest_threat": edges[0] if edges else None,
    }


@router.get("/maintenance-debt")
async def maintenance_debt(db: Annotated[AsyncSession, Depends(get_db)]):
    """Unique: accumulated cost of deferred maintenance across fleet."""
    eq_result = await db.execute(select(Equipment))
    total_debt = 0
    items = []

    for eq in eq_result.scalars().all():
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at)).limit(1)
        )
        p = await db.execute(
            select(Prediction)
            .where(Prediction.equipment_id == eq.id)
            .order_by(desc(Prediction.created_at)).limit(1)
        )
        health = h.scalar_one_or_none()
        pred = p.scalar_one_or_none()
        if not health or health.health_score >= 70:
            continue

        hourly = CRITICALITY_COST_PER_HOUR.get(eq.criticality, 180000)
        defer_days = max(1, int((70 - health.health_score) / 5))
        prob = pred.failure_probability if pred else 0.4
        debt = round(hourly * 8 * defer_days * prob * 0.01)
        total_debt += debt
        items.append({
            "equipment_code": eq.equipment_code,
            "health_score": health.health_score,
            "deferred_days": defer_days,
            "debt_inr": debt,
            "action": f"Restore {eq.equipment_code} health above 70%",
        })

    items.sort(key=lambda x: x["debt_inr"], reverse=True)
    return {
        "total_debt_inr": total_debt,
        "currency": "INR",
        "items": items,
        "interpretation": "Estimated production-at-risk cost if deferred maintenance continues",
    }


@router.get("/predictive-calendar")
async def predictive_calendar(db: Annotated[AsyncSession, Depends(get_db)]):
    """When each asset likely needs service based on RUL cycles."""
    eq_result = await db.execute(select(Equipment).order_by(Equipment.equipment_code))
    schedule = []

    for eq in eq_result.scalars().all():
        p = await db.execute(
            select(Prediction)
            .where(Prediction.equipment_id == eq.id)
            .order_by(desc(Prediction.created_at)).limit(1)
        )
        h = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at)).limit(1)
        )
        pred = p.scalar_one_or_none()
        health = h.scalar_one_or_none()
        rul = pred.rul_cycles if pred else 100
        fail_prob = pred.failure_probability if pred else 0.2
        cycles_per_day = 3
        days_until = max(0, rul // cycles_per_day)
        due = datetime.now(timezone.utc) + timedelta(days=days_until)
        schedule.append({
            "equipment_code": eq.equipment_code,
            "equipment_name": eq.name,
            "rul_cycles": rul,
            "health_score": round(health.health_score, 1) if health else 100.0,
            "failure_probability": round(fail_prob, 3),
            "estimated_service_date": due.strftime("%Y-%m-%d"),
            "days_until": days_until,
            "urgency": "overdue" if rul < 5 else "soon" if rul < 15 else "planned",
            "window_action": (
                "Schedule shutdown this week" if rul < 10 else
                f"Plan maintenance within {days_until} days"
            ),
        })

    schedule.sort(key=lambda x: x["days_until"])
    counts = {
        "overdue": sum(1 for s in schedule if s["urgency"] == "overdue"),
        "soon": sum(1 for s in schedule if s["urgency"] == "soon"),
        "planned": sum(1 for s in schedule if s["urgency"] == "planned"),
    }
    return {
        "schedule": schedule,
        "counts": counts,
        "interpretation": "Service dates from ML RUL (remaining useful life in cycles). Overdue <5 cycles, soon <15.",
    }
