from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.entities import Equipment, EquipmentHealthScore, Prediction
from app.services.operational_service import (
    build_maintenance_plan,
    get_delay_logs,
    get_fault_messages,
    load_fault_code_dictionary,
)
from app.services.process_defect_service import detect_process_defects

router = APIRouter(prefix="/operational", tags=["operational"])


@router.get("/summary")
async def operational_summary(db: Annotated[AsyncSession, Depends(get_db)]):
    """Overview of operational & failure inputs ingested."""
    delays = await get_delay_logs(db, limit=100)
    faults = await get_fault_messages(db, active_only=True, limit=100)
    codes = load_fault_code_dictionary()
    return {
        "delay_log_count": len(delays),
        "active_fault_count": len(faults),
        "fault_code_dictionary_size": len(codes),
        "total_recent_delay_hours": round(sum(d["delay_hours"] for d in delays), 2),
        "data_sources": [
            "data/operational/delay_logs.csv",
            "data/operational/fault_messages.csv",
            "data/operational/fault_codes.csv",
            "data/documents/incident_*.md",
            "data/tata-hackathon/logs/sample_equipment_delay_log.csv",
            "data/tata-hackathon/logs/sample_sensor_readings.csv",
            "data/tata-hackathon/samples/rul_sensor_data_sample.csv",
            "data/tata-hackathon/manuals/*.txt",
        ],
    }


@router.get("/delay-logs")
async def delay_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    return {"items": await get_delay_logs(db, equipment_code, limit)}


@router.get("/fault-messages")
async def fault_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(default=50, le=200),
):
    return {"items": await get_fault_messages(db, equipment_code, active_only, limit)}


@router.get("/fault-codes")
async def fault_codes():
    return {"items": load_fault_code_dictionary()}


@router.get("/process-defects")
async def process_defects(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: str,
):
    eq_result = await db.execute(
        select(Equipment).where(Equipment.equipment_code == equipment_code)
    )
    equipment = eq_result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    from app.models.entities import SensorData

    sensor_result = await db.execute(
        select(SensorData)
        .where(SensorData.equipment_id == equipment.id)
        .order_by(desc(SensorData.timestamp))
        .limit(1)
    )
    latest = sensor_result.scalar_one_or_none()
    readings = {}
    if latest:
        readings = {
            "temperature": latest.temperature or 0,
            "vibration": latest.vibration or 0,
            "pressure": latest.pressure or 0,
            "motor_current": latest.motor_current or 0,
            "operational_setting_1": latest.operational_setting_1 or 0,
            "operational_setting_2": latest.operational_setting_2 or 0,
            "operational_setting_3": latest.operational_setting_3 or 0,
        }

    defects = detect_process_defects(equipment.equipment_type, readings, equipment_code)
    return {
        "equipment_code": equipment_code,
        "equipment_type": equipment.equipment_type,
        "sensor_snapshot": readings,
        "process_defects": defects,
        "source": "Rule-based mapping from process_defects_steel_operations.md + live sensors",
    }


@router.get("/maintenance-plan")
async def maintenance_plan(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_code: str,
):
    eq_result = await db.execute(
        select(Equipment).where(Equipment.equipment_code == equipment_code)
    )
    equipment = eq_result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    h = await db.execute(
        select(EquipmentHealthScore)
        .where(EquipmentHealthScore.equipment_id == equipment.id)
        .order_by(desc(EquipmentHealthScore.computed_at))
        .limit(1)
    )
    p = await db.execute(
        select(Prediction)
        .where(Prediction.equipment_id == equipment.id)
        .order_by(desc(Prediction.created_at))
        .limit(1)
    )
    health = h.scalar_one_or_none()
    pred = p.scalar_one_or_none()

    from app.models.entities import SensorData

    sensor_result = await db.execute(
        select(SensorData)
        .where(SensorData.equipment_id == equipment.id)
        .order_by(desc(SensorData.timestamp))
        .limit(1)
    )
    latest = sensor_result.scalar_one_or_none()
    readings = {}
    if latest:
        readings = {
            "temperature": latest.temperature or 0,
            "vibration": latest.vibration or 0,
            "pressure": latest.pressure or 0,
            "motor_current": latest.motor_current or 0,
            "operational_setting_1": latest.operational_setting_1 or 0,
            "operational_setting_2": latest.operational_setting_2 or 0,
        }

    plan = await build_maintenance_plan(
        db,
        equipment,
        health_score=health.health_score if health else 75,
        risk_level=health.risk_level if health else "medium",
        failure_probability=pred.failure_probability if pred else 0.3,
        rul_cycles=pred.rul_cycles if pred else None,
        sensor_readings=readings,
    )
    return plan
