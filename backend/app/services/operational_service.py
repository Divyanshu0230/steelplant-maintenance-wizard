"""Operational data: delay logs, fault messages, maintenance plans."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import pandas as pd
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.entities import Equipment, EquipmentDelayLog, FaultMessage, SparePart
from app.services.process_defect_service import detect_process_defects

settings = get_settings()


async def recent_downtime_hours(
    db: AsyncSession, equipment_id: int, days: int = 30
) -> float:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(EquipmentDelayLog)
        .where(
            EquipmentDelayLog.equipment_id == equipment_id,
            EquipmentDelayLog.logged_at >= cutoff,
        )
    )
    rows = result.scalars().all()
    return round(sum(r.delay_hours for r in rows), 2)


async def delay_severity_score(db: AsyncSession, equipment_id: int) -> float:
    """0–1 score from recent delay logs weighted by severity."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    result = await db.execute(
        select(EquipmentDelayLog)
        .where(
            EquipmentDelayLog.equipment_id == equipment_id,
            EquipmentDelayLog.logged_at >= cutoff,
        )
    )
    weights = {"low": 0.2, "medium": 0.5, "high": 0.8, "critical": 1.0}
    score = 0.0
    for row in result.scalars().all():
        score += row.delay_hours * weights.get(row.severity, 0.5)
    return round(min(1.0, score / 24), 3)


async def get_delay_logs(
    db: AsyncSession, equipment_code: Optional[str] = None, limit: int = 50
) -> list[dict[str, Any]]:
    query = select(EquipmentDelayLog, Equipment).join(
        Equipment, EquipmentDelayLog.equipment_id == Equipment.id
    ).order_by(desc(EquipmentDelayLog.logged_at)).limit(limit)
    if equipment_code:
        query = query.where(Equipment.equipment_code == equipment_code)
    result = await db.execute(query)
    return [
        {
            "id": log.id,
            "equipment_code": eq.equipment_code,
            "equipment_name": eq.name,
            "logged_at": log.logged_at.isoformat(),
            "delay_hours": log.delay_hours,
            "production_loss_tonnes": log.production_loss_tonnes,
            "reason": log.reason,
            "severity": log.severity,
        }
        for log, eq in result.all()
    ]


async def get_fault_messages(
    db: AsyncSession,
    equipment_code: Optional[str] = None,
    active_only: bool = True,
    limit: int = 50,
) -> list[dict[str, Any]]:
    query = select(FaultMessage, Equipment).join(
        Equipment, FaultMessage.equipment_id == Equipment.id
    ).order_by(desc(FaultMessage.logged_at)).limit(limit)
    if equipment_code:
        query = query.where(Equipment.equipment_code == equipment_code)
    if active_only:
        query = query.where(FaultMessage.is_active.is_(True))
    result = await db.execute(query)
    return [
        {
            "id": fm.id,
            "equipment_code": eq.equipment_code,
            "fault_code": fm.fault_code,
            "message": fm.message,
            "severity": fm.severity,
            "source": fm.source,
            "logged_at": fm.logged_at.isoformat(),
            "is_active": fm.is_active,
        }
        for fm, eq in result.all()
    ]


def load_fault_code_dictionary() -> list[dict[str, str]]:
    path = settings.data_dir / "operational" / "fault_codes.csv"
    if not path.exists():
        return []
    df = pd.read_csv(path)
    return df.to_dict(orient="records")


async def operational_context_for_equipment(
    db: AsyncSession, equipment: Optional[Equipment]
) -> str:
    if not equipment:
        return "No equipment context."
    delays = await get_delay_logs(db, equipment.equipment_code, limit=3)
    faults = await get_fault_messages(db, equipment.equipment_code, active_only=True, limit=5)
    lines = []
    if delays:
        lines.append("Recent delay logs:")
        for d in delays:
            lines.append(
                f"- {d['logged_at'][:10]}: {d['delay_hours']}h delay, "
                f"{d['severity']} — {d['reason'][:120]}"
            )
    if faults:
        lines.append("Active SCADA/DCS fault messages:")
        for f in faults:
            lines.append(f"- [{f['fault_code']}] {f['message']} ({f['severity']})")
    return "\n".join(lines) if lines else "No recent delay logs or active fault messages."


async def build_maintenance_plan(
    db: AsyncSession,
    equipment: Equipment,
    *,
    health_score: float = 75,
    risk_level: str = "medium",
    failure_probability: float = 0.3,
    rul_cycles: Optional[int] = None,
    sensor_readings: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    """Structured maintenance plan: immediate, optimized, long-term, spares."""
    downtime = await recent_downtime_hours(db, equipment.id)
    delay_score = await delay_severity_score(db, equipment.id)
    defects = detect_process_defects(
        equipment.equipment_type, sensor_readings or {}, equipment.equipment_code
    )

    spare_result = await db.execute(
        select(SparePart).where(SparePart.equipment_type == equipment.equipment_type)
    )
    spares = spare_result.scalars().all()
    low_stock = [s for s in spares if s.quantity_available < s.minimum_stock]

    immediate: list[str] = []
    if risk_level in ("critical", "high"):
        immediate.append(f"Inspect {equipment.equipment_code} within 24h — risk {risk_level}")
    if failure_probability >= 0.7:
        immediate.append("Schedule corrective maintenance before next production shift")
    for d in defects[:2]:
        immediate.append(f"Address process defect: {d['defect']} — {d['action']}")
    active_faults = await get_fault_messages(db, equipment.equipment_code, active_only=True, limit=3)
    for f in active_faults:
        if f["severity"] in ("critical", "high"):
            immediate.append(f"Clear fault {f['fault_code']}: {f['message'][:80]}")

    optimized = [
        f"Priority score elevated by delay severity ({delay_score:.0%}) and {downtime}h downtime (30d)",
        f"Target health restoration above 70% (current {health_score:.0f}%)",
    ]
    if rul_cycles is not None and rul_cycles < 30:
        optimized.append(f"Plan shutdown within {max(1, rul_cycles // 3)} days based on RUL {rul_cycles} cycles")
    optimized.append("Coordinate with procurement for any low-stock critical spares")

    long_term = [
        "Continue 60s ML monitoring scan and weekly vibration trending",
        "Review sensor baselines after any corrective action",
        "Cross-check process defect indicators during each shift handover",
    ]
    if equipment.criticality == "critical":
        long_term.append("Maintain dual-spare policy for critical rotating assemblies")

    spare_strategy = []
    if low_stock:
        for s in low_stock:
            spare_strategy.append(
                f"Procure {s.part_code} ({s.name}): need {s.minimum_stock - s.quantity_available} units, "
                f"lead time {s.lead_time_days}d"
            )
    else:
        spare_strategy.append("Spare stock adequate for current equipment type — monitor weekly")

    urgency = "immediate" if risk_level == "critical" else "high" if risk_level == "high" else "planned"

    return {
        "equipment_code": equipment.equipment_code,
        "urgency": urgency,
        "immediate_actions": immediate or ["Continue monitoring — no immediate intervention required"],
        "optimized_maintenance_plan": optimized,
        "long_term_monitoring": long_term,
        "spare_procurement_strategy": spare_strategy,
        "process_defects": defects,
        "delay_severity_score": delay_score,
        "recent_downtime_hours_30d": downtime,
        "priority_factors": {
            "process_criticality": equipment.criticality,
            "delay_severity": delay_score,
            "spares_available": sum(s.quantity_available for s in spares),
            "max_lead_time_days": max((s.lead_time_days for s in spares), default=7),
        },
    }


def import_operational_csvs(
    equipment_map: dict[str, Any],
) -> tuple[list[dict], list[dict]]:
    """Parse CSV files for seeding."""
    op_dir = settings.data_dir / "operational"
    delay_rows: list[dict] = []
    fault_rows: list[dict] = []

    delay_path = op_dir / "delay_logs.csv"
    if delay_path.exists():
        df = pd.read_csv(delay_path)
        for _, row in df.iterrows():
            code = str(row["equipment_code"])
            if code not in equipment_map:
                continue
            delay_rows.append({
                "equipment_id": equipment_map[code].id,
                "logged_at": datetime.fromisoformat(str(row["logged_at"])).replace(tzinfo=timezone.utc),
                "delay_hours": float(row["delay_hours"]),
                "production_loss_tonnes": float(row.get("production_loss_tonnes") or 0),
                "reason": str(row["reason"]),
                "severity": str(row.get("severity", "medium")),
                "metadata_": {"source": "operational_csv"},
            })

    fault_path = op_dir / "fault_messages.csv"
    if fault_path.exists():
        df = pd.read_csv(fault_path)
        for _, row in df.iterrows():
            code = str(row["equipment_code"])
            if code not in equipment_map:
                continue
            fault_rows.append({
                "equipment_id": equipment_map[code].id,
                "fault_code": str(row["fault_code"]),
                "message": str(row["message"]),
                "severity": str(row.get("severity", "medium")),
                "source": str(row.get("source", "SCADA")),
                "logged_at": datetime.fromisoformat(str(row["logged_at"])).replace(tzinfo=timezone.utc),
                "is_active": str(row.get("is_active", "true")).lower() in ("true", "1", "yes"),
                "metadata_": {"source": "operational_csv"},
            })

    return delay_rows, fault_rows
