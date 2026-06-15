"""Background monitoring: ML predictions, health scores, and alert generation."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.ml.model_registry import get_model_registry
from app.ml.risk_engine import RiskEngine
from app.ml.rul_predictor import SENSOR_FEATURES
from app.models.entities import Alert, Equipment, EquipmentHealthScore, Prediction, SensorData, SparePart
from app.services.alert_service import AlertService
from app.services.monitoring_events import record_event, set_last_scan

logger = get_logger(__name__)


class MonitoringService:
    def __init__(self) -> None:
        self.registry = get_model_registry()
        self.risk_engine = RiskEngine()
        self.alert_service = AlertService()

    async def run_full_scan(self, db: AsyncSession) -> dict:
        """Run ML on all equipment, persist predictions/health, generate alerts."""
        result = await db.execute(select(Equipment).order_by(Equipment.id))
        equipment_list = result.scalars().all()
        stats = {"equipment_scanned": 0, "alerts_created": 0, "predictions_saved": 0}

        for eq in equipment_list:
            try:
                created = await self._scan_equipment(db, eq)
                stats["equipment_scanned"] += 1
                stats["predictions_saved"] += 1
                stats["alerts_created"] += created
            except Exception as exc:
                logger.warning("Monitoring scan failed for %s: %s", eq.equipment_code, exc)

        await db.commit()
        logger.info("Monitoring scan: %s", stats)
        set_last_scan(stats)
        record_event(
            "scan_complete",
            f"ML scan: {stats['equipment_scanned']} assets, {stats['alerts_created']} new alerts",
            severity="info" if stats["alerts_created"] == 0 else "warning",
            data=stats,
        )
        await self._broadcast_update(db, stats)
        return stats

    async def _broadcast_update(self, db: AsyncSession, stats: dict) -> None:
        try:
            from sqlalchemy import select
            from app.models.entities import Alert, Equipment, EquipmentHealthScore, Prediction
            from app.services.ws_manager import ws_manager

            health_data = []
            eq_result = await db.execute(select(Equipment))
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
                health = h.scalar_one_or_none()
                pred = p.scalar_one_or_none()
                health_data.append({
                    "equipment_code": eq.equipment_code,
                    "health_score": health.health_score if health else 0,
                    "risk_level": health.risk_level if health else "medium",
                    "rul_cycles": pred.rul_cycles if pred else None,
                })

            alert_result = await db.execute(
                select(Alert).order_by(Alert.created_at.desc()).limit(10)
            )
            alerts = [
                {"id": a.id, "title": a.title, "level": a.alert_level, "source": a.source}
                for a in alert_result.scalars().all()
            ]
            await ws_manager.broadcast("monitoring_update", {
                "stats": stats,
                "health": health_data,
                "alerts": alerts,
            })
        except Exception as exc:
            logger.debug("WS broadcast skipped: %s", exc)

    async def _scan_equipment(self, db: AsyncSession, equipment: Equipment) -> int:
        sensor_result = await db.execute(
            select(SensorData)
            .where(SensorData.equipment_id == equipment.id)
            .order_by(desc(SensorData.timestamp))
            .limit(100)
        )
        sensors = list(sensor_result.scalars().all())
        if not sensors:
            return 0

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

        if len(sensors) >= 10:
            import numpy as np
            matrix = np.array([
                [
                    s.temperature or 0, s.vibration or 0, s.pressure or 0,
                    s.motor_current or 0, s.operational_setting_1 or 0,
                    s.operational_setting_2 or 0, s.operational_setting_3 or 0,
                ]
                for s in reversed(sensors)
            ])
            self.registry.fit_anomaly_baseline(matrix)

        anomaly = self.registry.anomaly_detector.detect(readings, SENSOR_FEATURES)
        rul = self.registry.rul_predictor.predict(readings)

        spare_result = await db.execute(
            select(SparePart)
            .where(SparePart.equipment_type == equipment.equipment_type)
            .limit(1)
        )
        spare = spare_result.scalar_one_or_none()

        from app.services.operational_service import recent_downtime_hours
        downtime_recent = await recent_downtime_hours(db, equipment.id)

        risk = self.risk_engine.assess(
            equipment_criticality=equipment.criticality,
            failure_probability=rul.failure_probability,
            anomaly_severity=anomaly.severity,
            spare_availability=spare.quantity_available if spare else 0,
            lead_time_days=spare.lead_time_days if spare else 7,
            downtime_hours_recent=downtime_recent,
        )

        health_score = round(max(0, (1 - rul.degradation_score) * 100), 2)
        data_source = (latest.metadata_ or {}).get("source", "plant_sensors")
        is_cmapss = "CMAPSS" in data_source.upper() or "NASA" in data_source.upper()
        if is_cmapss and latest.health_indicator is not None:
            health_score = round(latest.health_indicator * 100, 2)
            if health_score >= 70:
                risk_level = "low"
            elif health_score >= 55:
                risk_level = "medium"
            elif health_score >= 40:
                risk_level = "high"
            else:
                risk_level = "critical"
        else:
            risk_level = risk.risk_level

        db.add(Prediction(
            equipment_id=equipment.id,
            prediction_type="monitoring_scan",
            failure_probability=rul.failure_probability,
            rul_cycles=rul.rul_cycles,
            degradation_score=rul.degradation_score,
            risk_level=risk.risk_level,
            model_version=rul.model_version,
            features={**readings, "data_source": data_source},
        ))
        db.add(EquipmentHealthScore(
            equipment_id=equipment.id,
            health_score=health_score,
            anomaly_score=anomaly.anomaly_score,
            risk_level=risk_level,
            factors={**risk.factors, "data_source": data_source},
        ))

        alerts_created = 0
        if anomaly.is_anomaly:
            if not await self._active_alert_exists(db, equipment.id, "anomaly_monitor"):
                await self.alert_service.create_alert(
                    db,
                    equipment_id=equipment.id,
                    alert_level=anomaly.severity,
                    title=f"Sensor anomaly — {equipment.equipment_code}",
                    message=(
                        f"ML anomaly detection flagged abnormal readings. "
                        f"Sensors: {', '.join(anomaly.contributing_sensors) or 'multiple'}. "
                        f"Method: {anomaly.method}."
                    ),
                    source="anomaly_monitor",
                    metadata={"readings": readings, "data_source": data_source},
                )
                record_event(
                    "alert",
                    f"Anomaly on {equipment.equipment_code}: {anomaly.severity}",
                    equipment_code=equipment.equipment_code,
                    severity=anomaly.severity,
                )
                alerts_created += 1

        if rul.failure_probability >= 0.6:
            if not await self._active_alert_exists(db, equipment.id, "predictive_maintenance"):
                level = "critical" if rul.failure_probability >= 0.85 else "high"
                await self.alert_service.create_alert(
                    db,
                    equipment_id=equipment.id,
                    alert_level=level,
                    title=f"High failure risk — {equipment.equipment_code}",
                    message=(
                        f"Predictive model: {rul.failure_probability:.0%} failure probability, "
                        f"RUL ~{rul.rul_cycles} cycles. Health score: {health_score:.0f}%."
                    ),
                    source="predictive_maintenance",
                    metadata={"rul_cycles": rul.rul_cycles, "data_source": data_source},
                )
                alerts_created += 1

        if risk.risk_level == "critical" and health_score < 50:
            if not await self._active_alert_exists(db, equipment.id, "risk_engine"):
                await self.alert_service.create_alert(
                    db,
                    equipment_id=equipment.id,
                    alert_level="critical",
                    title=f"Critical equipment risk — {equipment.equipment_code}",
                    message=risk.explanation,
                    source="risk_engine",
                    metadata={"factors": risk.factors},
                )
                alerts_created += 1

        return alerts_created

    async def _active_alert_exists(
        self, db: AsyncSession, equipment_id: int, source: str
    ) -> bool:
        """One unresolved alert per equipment per source — stops alert spam."""
        result = await db.execute(
            select(Alert)
            .where(
                Alert.equipment_id == equipment_id,
                Alert.source == source,
                Alert.is_resolved.is_(False),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _recent_alert_exists(
        self, db: AsyncSession, equipment_id: int, source: str, minutes: int = 30
    ) -> bool:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        result = await db.execute(
            select(Alert)
            .where(
                Alert.equipment_id == equipment_id,
                Alert.source == source,
                Alert.created_at >= cutoff,
                Alert.is_resolved.is_(False),
            )
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def simulate_live_reading(self, db: AsyncSession, equipment_id: int) -> Optional[dict]:
        """Advance one sensor cycle for live monitoring demo."""
        eq_result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
        equipment = eq_result.scalar_one_or_none()
        if not equipment:
            return None

        latest_result = await db.execute(
            select(SensorData)
            .where(SensorData.equipment_id == equipment_id)
            .order_by(desc(SensorData.cycle), desc(SensorData.timestamp))
            .limit(1)
        )
        latest = latest_result.scalar_one_or_none()
        if not latest:
            return None

        # Slight degradation on next cycle
        factor = 1.02
        new_reading = SensorData(
            equipment_id=equipment_id,
            timestamp=datetime.now(timezone.utc),
            cycle=(latest.cycle or 0) + 1,
            temperature=round((latest.temperature or 45) * factor, 2),
            vibration=round((latest.vibration or 2.5) * factor, 2),
            pressure=round((latest.pressure or 100) * 1.01, 2),
            motor_current=round((latest.motor_current or 20) * factor, 2),
            operational_setting_1=latest.operational_setting_1,
            operational_setting_2=latest.operational_setting_2,
            operational_setting_3=latest.operational_setting_3,
            health_indicator=round(max(0, (latest.health_indicator or 0.5) - 0.01), 3),
            metadata_={**(latest.metadata_ or {}), "live_simulated": True},
        )
        db.add(new_reading)
        await db.flush()
        await self._scan_equipment(db, equipment)
        await db.commit()
        record_event(
            "sensor_tick",
            f"Live sensor cycle {new_reading.cycle} on {equipment.equipment_code}",
            equipment_code=equipment.equipment_code,
            severity="info",
            data={
                "cycle": new_reading.cycle,
                "vibration": new_reading.vibration,
                "temperature": new_reading.temperature,
            },
        )
        try:
            from app.services.ws_manager import ws_manager
            await ws_manager.broadcast("sensor_tick", {
                "equipment_code": equipment.equipment_code,
                "cycle": new_reading.cycle,
                "vibration": new_reading.vibration,
                "temperature": new_reading.temperature,
            })
        except Exception:
            pass
        return {"equipment_id": equipment_id, "cycle": new_reading.cycle, "timestamp": new_reading.timestamp.isoformat()}


_monitoring: Optional[MonitoringService] = None


def get_monitoring_service() -> MonitoringService:
    global _monitoring
    if _monitoring is None:
        _monitoring = MonitoringService()
    return _monitoring
