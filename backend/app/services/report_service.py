from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.models.entities import Alert, Equipment, MaintenanceRecord, Report


class ReportService:
    async def generate_from_agent_state(
        self,
        db: AsyncSession,
        state: AgentState,
        report_type: str = "maintenance_summary",
    ) -> Report:
        equipment_id = state.get("equipment_id")
        title = f"Maintenance Report — {state.get('equipment_code', 'Plant')}"
        content: dict[str, Any] = {
            "query": state.get("query"),
            "equipment_code": state.get("equipment_code"),
            "diagnosis": {
                "probable_causes": state.get("probable_causes", []),
                "confidence_score": state.get("confidence_score", 0),
            },
            "predictive": {
                "failure_probability": state.get("failure_probability"),
                "rul_cycles": state.get("rul_cycles"),
                "degradation_score": state.get("degradation_score"),
                "anomaly_detected": state.get("anomaly_detected"),
            },
            "risk": {
                "risk_level": state.get("risk_level"),
                "factors": state.get("risk_factors", {}),
            },
            "maintenance_actions": state.get("maintenance_actions", []),
            "spare_recommendations": state.get("spare_recommendations", []),
            "citations": state.get("citations", []),
            "executive_summary": state.get("report_summary", state.get("final_answer", "")),
        }
        report = Report(
            report_type=report_type,
            equipment_id=equipment_id,
            title=title,
            content=content,
            generated_by="report_agent",
        )
        db.add(report)
        await db.flush()
        return report

    async def generate_shift_briefing(self, db: AsyncSession) -> Report:
        """Fast plant-wide shift handover — no full agent orchestrator."""
        now = datetime.now(timezone.utc)
        since_8h = now - timedelta(hours=8)

        alert_rows = await db.execute(
            select(Alert, Equipment)
            .outerjoin(Equipment, Alert.equipment_id == Equipment.id)
            .where(Alert.is_resolved.is_(False))
            .order_by(desc(Alert.created_at))
            .limit(12)
        )
        alerts = alert_rows.all()

        log_rows = await db.execute(
            select(MaintenanceRecord, Equipment)
            .join(Equipment, MaintenanceRecord.equipment_id == Equipment.id)
            .where(MaintenanceRecord.performed_at >= since_8h)
            .order_by(desc(MaintenanceRecord.performed_at))
            .limit(10)
        )
        logbook = log_rows.all()

        eq_result = await db.execute(select(Equipment))
        equipment_list = eq_result.scalars().all()

        priority_lines: list[dict[str, Any]] = []
        for eq in equipment_list[:8]:
            priority_lines.append({
                "priority": eq.criticality or "medium",
                "action": f"Review {eq.equipment_code} — {eq.name}",
                "timeframe": "This shift",
                "rationale": f"{eq.location or 'Plant'} · {eq.criticality or 'standard'} criticality",
            })

        alert_count = len(alerts)
        log_count = len(logbook)
        critical_alerts = sum(
            1 for a, _ in alerts if (a.alert_level or "").lower() in ("high", "critical")
        )

        summary_parts = [
            f"Shift handover generated at {now.strftime('%Y-%m-%d %H:%M UTC')}.",
            f"Active alerts: {alert_count} ({critical_alerts} high/critical).",
            f"Logbook entries (last 8h): {log_count}.",
        ]
        if alerts:
            summary_parts.append("\nTop alerts:")
            for alert, eq in alerts[:5]:
                code = eq.equipment_code if eq else "Plant"
                summary_parts.append(f"• [{alert.alert_level}] {code}: {alert.title}")
        if logbook:
            summary_parts.append("\nRecent maintenance:")
            for rec, eq in logbook[:5]:
                summary_parts.append(
                    f"• {eq.equipment_code}: {rec.maintenance_type} — {str(rec.description)[:120]}"
                )

        top_risk = "medium"
        if critical_alerts >= 3:
            top_risk = "critical"
        elif critical_alerts >= 1:
            top_risk = "high"

        content: dict[str, Any] = {
            "query": "Shift handover briefing",
            "equipment_code": "PLANT-WIDE",
            "equipment_name": "Steel Plant Operations",
            "diagnosis": {"probable_causes": [], "confidence_score": 0},
            "predictive": {},
            "risk": {"risk_level": top_risk, "factors": {"active_alerts": alert_count}},
            "maintenance_actions": priority_lines[:6],
            "spare_recommendations": [],
            "executive_summary": "\n".join(summary_parts),
            "shift_meta": {
                "alerts_24h": alert_count,
                "logbook_8h": log_count,
                "generated_at": now.isoformat(),
            },
        }

        title = f"Shift Handover Briefing — {now.strftime('%d %b %Y %H:%M')}"
        report = Report(
            report_type="shift_briefing",
            title=title,
            content=content,
            generated_by="shift_briefing",
        )
        db.add(report)
        await db.flush()
        return report

    def preview_from_content(self, content: dict[str, Any]) -> str:
        summary = content.get("executive_summary") or content.get("query") or ""
        return str(summary).strip()[:220]

    async def create_logbook_entry(
        self,
        db: AsyncSession,
        equipment_id: int,
        description: str,
        maintenance_type: str = "inspection",
        performed_by: str = "Maintenance Wizard",
        *,
        parts_used: Optional[str] = None,
        duration_hours: Optional[float] = None,
        cost: Optional[float] = None,
        outcome: Optional[str] = None,
    ) -> MaintenanceRecord:
        from datetime import datetime, timezone

        record = MaintenanceRecord(
            equipment_id=equipment_id,
            maintenance_type=maintenance_type,
            performed_at=datetime.now(timezone.utc),
            performed_by=performed_by,
            description=description,
            parts_used=parts_used,
            duration_hours=duration_hours,
            cost=cost,
            outcome=outcome or "logged",
        )
        db.add(record)
        await db.flush()
        return record
