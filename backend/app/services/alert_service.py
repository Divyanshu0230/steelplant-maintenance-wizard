from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import Alert, AnomalyEvent, Equipment
from app.models.schemas import ALERT_RESOLUTION_TYPES


class AlertService:
    async def create_alert(
        self,
        db: AsyncSession,
        *,
        equipment_id: Optional[int],
        alert_level: str,
        title: str,
        message: str,
        source: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Alert:
        alert = Alert(
            equipment_id=equipment_id,
            alert_level=alert_level,
            title=title,
            message=message,
            source=source,
            metadata_=metadata or {},
        )
        db.add(alert)
        await db.flush()
        return alert

    async def create_from_agent_alerts(
        self, db: AsyncSession, equipment_id: Optional[int], agent_alerts: list[dict[str, Any]]
    ) -> list[Alert]:
        created: list[Alert] = []
        for item in agent_alerts:
            alert = await self.create_alert(
                db,
                equipment_id=equipment_id,
                alert_level=item.get("level", "info"),
                title=item.get("title", "Maintenance Alert"),
                message=item.get("message", ""),
                source=item.get("source", "system"),
            )
            created.append(alert)
        return created

    async def list_alerts(
        self,
        db: AsyncSession,
        limit: int = 50,
        unacknowledged_only: bool = False,
        unresolved_only: bool = False,
        role_name: Optional[str] = None,
    ) -> list[Alert]:
        query = select(Alert).order_by(desc(Alert.created_at)).limit(limit)
        if unacknowledged_only:
            query = query.where(Alert.is_acknowledged.is_(False))
        if unresolved_only:
            query = query.where(Alert.is_resolved.is_(False))
        result = await db.execute(query)
        alerts = list(result.scalars().all())
        if role_name == "supervisor":
            return [a for a in alerts if a.alert_level in ("critical", "high", "warning")]
        if role_name == "engineer":
            return alerts
        return alerts

    async def acknowledge(self, db: AsyncSession, alert_id: int, user_id: Optional[int] = None) -> Optional[Alert]:
        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return None
        alert.is_acknowledged = True
        alert.acknowledged_by = user_id
        alert.acknowledged_at = datetime.now(timezone.utc)
        await db.flush()
        return alert

    async def resolve(
        self,
        db: AsyncSession,
        alert_id: int,
        *,
        resolution_type: str,
        resolution_notes: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Alert]:
        if resolution_type not in ALERT_RESOLUTION_TYPES:
            raise ValueError(f"Invalid resolution_type. Must be one of: {', '.join(ALERT_RESOLUTION_TYPES)}")

        result = await db.execute(select(Alert).where(Alert.id == alert_id))
        alert = result.scalar_one_or_none()
        if not alert:
            return None
        if alert.is_resolved:
            return alert

        now = datetime.now(timezone.utc)
        if not alert.is_acknowledged:
            alert.is_acknowledged = True
            alert.acknowledged_by = user_id
            alert.acknowledged_at = now

        alert.is_resolved = True
        alert.resolved_by = user_id
        alert.resolved_at = now
        alert.resolution_type = resolution_type
        alert.resolution_notes = (resolution_notes or "").strip() or None
        await db.flush()
        return alert

    async def record_anomaly(
        self,
        db: AsyncSession,
        equipment_id: int,
        sensor_name: str,
        observed_value: float,
        severity: str,
        detection_method: str,
    ) -> AnomalyEvent:
        event = AnomalyEvent(
            equipment_id=equipment_id,
            detected_at=datetime.now(timezone.utc),
            anomaly_type="sensor_threshold",
            severity=severity,
            sensor_name=sensor_name,
            observed_value=observed_value,
            detection_method=detection_method,
        )
        db.add(event)
        await db.flush()
        return event
