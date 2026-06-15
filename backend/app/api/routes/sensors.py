from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.ml.anomaly_detector import AnomalyDetector
from app.models.entities import Equipment, SensorData
from app.ml.iso_thresholds import assess_vibration_iso10816
from app.models.schemas import SensorHistoryPoint, SensorIngestRequest
from app.services.alert_service import AlertService
from app.services.monitoring_service import get_monitoring_service

router = APIRouter(prefix="/sensors", tags=["sensors"])
alert_service = AlertService()


def _readings_to_fields(readings: list[dict]) -> dict[str, float]:
    mapping = {
        "vibration_mm_s": "vibration",
        "vibration": "vibration",
        "temperature_c": "temperature",
        "oil_temperature_c": "temperature",
        "current_a": "motor_current",
        "motor_current": "motor_current",
        "pressure_bar": "pressure",
        "oil_pressure_bar": "pressure",
        "pressure": "pressure",
    }
    out: dict[str, float] = {}
    for item in readings:
        st = str(item.get("sensor_type", "")).lower()
        for key, field in mapping.items():
            if key in st or st == key:
                out[field] = float(item.get("value", 0))
                break
    return out


@router.get("/history", response_model=list[SensorHistoryPoint])
async def sensor_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_id: Optional[int] = None,
    equipment_code: Optional[str] = None,
    limit: int = Query(default=120, le=500),
):
    """Time-series sensor readings for monitoring charts."""
    equipment = None
    if equipment_id:
        r = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
        equipment = r.scalar_one_or_none()
    elif equipment_code:
        r = await db.execute(select(Equipment).where(Equipment.equipment_code == equipment_code))
        equipment = r.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    result = await db.execute(
        select(SensorData)
        .where(SensorData.equipment_id == equipment.id)
        .order_by(desc(SensorData.cycle), desc(SensorData.timestamp))
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    source = (equipment.metadata_ or {}).get("data_source", "plant_sensors")
    return [
        SensorHistoryPoint(
            timestamp=row.timestamp,
            cycle=row.cycle,
            temperature=row.temperature,
            vibration=row.vibration,
            pressure=row.pressure,
            motor_current=row.motor_current,
            health_indicator=row.health_indicator,
            data_source=(row.metadata_ or {}).get("source", source),
        )
        for row in rows
    ]


@router.post("/simulate-tick")
async def simulate_sensor_tick(
    db: Annotated[AsyncSession, Depends(get_db)],
    equipment_id: int,
):
    """Advance one live sensor cycle (demo real-time feed)."""
    result = await get_monitoring_service().simulate_live_reading(db, equipment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Equipment or sensor data not found")
    return result


@router.post("/ingest")
async def ingest_sensor_reading(
    payload: SensorIngestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    eq_result = await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))
    equipment = eq_result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    fields = _readings_to_fields(payload.readings or [])
    temperature = payload.temperature if payload.temperature is not None else fields.get("temperature")
    vibration = payload.vibration if payload.vibration is not None else fields.get("vibration")
    pressure = payload.pressure if payload.pressure is not None else fields.get("pressure")
    motor_current = payload.motor_current if payload.motor_current is not None else fields.get("motor_current")

    reading = SensorData(
        equipment_id=payload.equipment_id,
        timestamp=datetime.now(timezone.utc),
        temperature=temperature,
        vibration=vibration,
        pressure=pressure,
        motor_current=motor_current,
        cycle=payload.cycle,
        metadata_={"source": "realtime_ingest", "readings": payload.readings or []},
    )
    db.add(reading)
    await db.flush()

    detector = AnomalyDetector()
    result = detector.detect(
        {
            "temperature": temperature or 0,
            "vibration": vibration or 0,
            "pressure": pressure or 0,
            "motor_current": motor_current or 0,
        },
        ["temperature", "vibration", "pressure", "motor_current"],
    )

    alert_created = None
    iso_assessment = None
    if vibration is not None:
        iso_assessment = assess_vibration_iso10816(float(vibration))

    if result.is_anomaly:
        alert_created = await alert_service.create_alert(
            db,
            equipment_id=payload.equipment_id,
            alert_level=result.severity,
            title=f"Real-time anomaly on {equipment.equipment_code}",
            message=f"Anomaly detected in sensors: {', '.join(result.contributing_sensors) or 'multiple'}",
            source="realtime_sensor_ingest",
        )
        if result.contributing_sensors:
            await alert_service.record_anomaly(
                db,
                equipment_id=payload.equipment_id,
                sensor_name=result.contributing_sensors[0],
                observed_value=getattr(payload, result.contributing_sensors[0], 0) or 0,
                severity=result.severity,
                detection_method=result.method,
            )

    if iso_assessment and iso_assessment.severity in ("high", "critical") and not alert_created:
        alert_created = await alert_service.create_alert(
            db,
            equipment_id=payload.equipment_id,
            alert_level=iso_assessment.severity,
            title=f"ISO 10816 {iso_assessment.label} on {equipment.equipment_code}",
            message=f"Vibration {vibration:.2f} mm/s exceeds ISO 10816 Zone {iso_assessment.zone} limit",
            source="iso_10816_threshold",
        )

    return {
        "sensor_id": reading.id,
        "anomaly_detected": result.is_anomaly,
        "anomaly_severity": result.severity,
        "alert_id": alert_created.id if alert_created else None,
        "iso_10816": {
            "zone": iso_assessment.zone,
            "severity": iso_assessment.severity,
            "label": iso_assessment.label,
        } if iso_assessment else None,
    }
