from typing import Annotated

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.ml.anomaly_detector import AnomalyDetector
from app.ml.risk_engine import RiskEngine
from app.ml.rul_predictor import RULPredictor, SENSOR_FEATURES
from app.models.entities import Equipment, EquipmentHealthScore, Prediction, SensorData, SparePart
from app.models.schemas import EquipmentCreate, EquipmentResponse, HealthScoreResponse, PredictionResponse

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.get("", response_model=list[EquipmentResponse])
async def list_equipment(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Equipment).order_by(Equipment.name))
    return result.scalars().all()


@router.post("", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    payload: EquipmentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    code = payload.equipment_code.strip().upper()
    if not code or not payload.name.strip():
        raise HTTPException(status_code=400, detail="Equipment code and name are required")

    existing = await db.execute(select(Equipment).where(Equipment.equipment_code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Equipment code {code} already exists")

    criticality = payload.criticality.lower()
    if criticality not in {"low", "medium", "high", "critical"}:
        raise HTTPException(status_code=400, detail="Criticality must be low, medium, high, or critical")

    eq = Equipment(
        equipment_code=code,
        name=payload.name.strip(),
        equipment_type=payload.equipment_type.strip(),
        location=(payload.location or "Plant").strip(),
        criticality=criticality,
        status="operational",
        manufacturer=payload.manufacturer or "Tata Steel Equipment Division",
        model=payload.model,
        metadata_={"data_source": "user_added"},
    )
    db.add(eq)
    await db.flush()

    now = datetime.now(timezone.utc)
    baseline_readings = [
        {
            "cycle": i,
            "temperature": 52.0 + i * 0.1,
            "vibration": 3.2 + i * 0.02,
            "pressure": 105.0 + i * 0.05,
            "motor_current": 22.0 + i * 0.08,
            "operational_setting_1": 0.55,
            "operational_setting_2": 0.42,
            "operational_setting_3": 0.31,
            "health_indicator": 0.92 - i * 0.001,
        }
        for i in range(1, 25)
    ]
    for i, reading in enumerate(baseline_readings):
        db.add(
            SensorData(
                equipment_id=eq.id,
                timestamp=now - timedelta(hours=len(baseline_readings) - i),
                **reading,
                metadata_={"source": "user_added_baseline"},
            )
        )

    db.add(
        EquipmentHealthScore(
            equipment_id=eq.id,
            health_score=88.0,
            anomaly_score=0.08,
            risk_level="low",
            factors={"source": "initial_baseline"},
        )
    )
    db.add(
        Prediction(
            equipment_id=eq.id,
            prediction_type="baseline",
            failure_probability=0.12,
            rul_cycles=180,
            degradation_score=0.12,
            risk_level="low",
            model_version="baseline",
            features=baseline_readings[-1],
        )
    )
    await db.flush()
    return eq


@router.get("/health", response_model=list[HealthScoreResponse])
async def equipment_health(db: Annotated[AsyncSession, Depends(get_db)]):
    equipment_result = await db.execute(select(Equipment))
    equipment_list = equipment_result.scalars().all()
    responses: list[HealthScoreResponse] = []

    for eq in equipment_list:
        health_result = await db.execute(
            select(EquipmentHealthScore)
            .where(EquipmentHealthScore.equipment_id == eq.id)
            .order_by(desc(EquipmentHealthScore.computed_at))
            .limit(1)
        )
        health = health_result.scalar_one_or_none()
        pred_result = await db.execute(
            select(Prediction)
            .where(Prediction.equipment_id == eq.id)
            .order_by(desc(Prediction.created_at))
            .limit(1)
        )
        pred = pred_result.scalar_one_or_none()
        responses.append(
            HealthScoreResponse(
                equipment_id=eq.id,
                equipment_code=eq.equipment_code,
                equipment_name=eq.name,
                health_score=health.health_score if health else 75.0,
                anomaly_score=health.anomaly_score if health else 0.1,
                risk_level=health.risk_level if health else "medium",
                failure_probability=pred.failure_probability if pred else None,
                rul_cycles=pred.rul_cycles if pred else None,
            )
        )
    return responses


@router.get("/{equipment_id}/predict", response_model=PredictionResponse)
async def predict_equipment(equipment_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    eq_result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equipment = eq_result.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    sensor_result = await db.execute(
        select(SensorData)
        .where(SensorData.equipment_id == equipment_id)
        .order_by(desc(SensorData.timestamp))
        .limit(100)
    )
    sensors = sensor_result.scalars().all()
    readings = {}
    if sensors:
        latest = sensors[0]
        readings = {
            "temperature": latest.temperature or 0.0,
            "vibration": latest.vibration or 0.0,
            "pressure": latest.pressure or 0.0,
            "motor_current": latest.motor_current or 0.0,
            "operational_setting_1": latest.operational_setting_1 or 0.0,
            "operational_setting_2": latest.operational_setting_2 or 0.0,
            "operational_setting_3": latest.operational_setting_3 or 0.0,
        }

    detector = AnomalyDetector()
    if len(sensors) >= 10:
        import numpy as np

        matrix = np.array(
            [
                [
                    s.temperature or 0,
                    s.vibration or 0,
                    s.pressure or 0,
                    s.motor_current or 0,
                    s.operational_setting_1 or 0,
                    s.operational_setting_2 or 0,
                    s.operational_setting_3 or 0,
                ]
                for s in sensors
            ]
        )
        detector.fit(matrix, SENSOR_FEATURES)

    anomaly = detector.detect(readings, SENSOR_FEATURES)
    rul = RULPredictor().predict(readings)

    spare_result = await db.execute(
        select(SparePart).where(SparePart.equipment_type == equipment.equipment_type).limit(1)
    )
    spare = spare_result.scalar_one_or_none()
    risk = RiskEngine().assess(
        equipment_criticality=equipment.criticality,
        failure_probability=rul.failure_probability,
        anomaly_severity=anomaly.severity,
        spare_availability=spare.quantity_available if spare else 0,
        lead_time_days=spare.lead_time_days if spare else 7,
    )

    db.add(
        Prediction(
            equipment_id=equipment_id,
            prediction_type="combined",
            failure_probability=rul.failure_probability,
            rul_cycles=rul.rul_cycles,
            degradation_score=rul.degradation_score,
            risk_level=risk.risk_level,
            model_version=rul.model_version,
            features=readings,
        )
    )
    db.add(
        EquipmentHealthScore(
            equipment_id=equipment_id,
            health_score=round((1 - rul.degradation_score) * 100, 2),
            anomaly_score=anomaly.anomaly_score,
            risk_level=risk.risk_level,
            factors=risk.factors,
        )
    )
    await db.flush()

    return PredictionResponse(
        equipment_id=equipment_id,
        failure_probability=rul.failure_probability,
        rul_cycles=rul.rul_cycles,
        degradation_score=rul.degradation_score,
        risk_level=risk.risk_level,
        anomaly_detected=anomaly.is_anomaly,
        contributing_factors=anomaly.contributing_sensors,
    )
