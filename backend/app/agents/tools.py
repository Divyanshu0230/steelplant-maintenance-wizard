"""Tool registry — agents invoke these autonomously during the agentic loop."""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ml.model_registry import get_model_registry
from app.ml.risk_engine import RiskEngine
from app.ml.rul_predictor import SENSOR_FEATURES
from app.ml.steel_domain_slm import get_steel_domain_slm
from app.models.entities import Equipment, SensorData, SparePart
from app.rag.knowledge_engine import KnowledgeEngine
from app.services.operational_service import operational_context_for_equipment
from app.services.process_defect_service import detect_process_defects


def dedupe_citations(citations: list[dict]) -> list[dict]:
    """Merge multiple RAG chunks from the same source into one citation."""
    by_source: dict[str, dict] = {}
    for c in citations:
        key = (c.get("source") or "unknown").strip().lower()
        if key not in by_source:
            by_source[key] = dict(c)
            continue
        existing = by_source[key]
        if c.get("relevance_score", 0) > existing.get("relevance_score", 0):
            by_source[key] = dict(c)
            existing = by_source[key]
        ex_b = (c.get("excerpt") or "")[:60]
        ex_a = (existing.get("excerpt") or "")[:60]
        if ex_b and ex_b != ex_a:
            merged = f"{existing.get('excerpt', '')} … {c.get('excerpt', '')}".strip()
            existing["excerpt"] = merged[:400]
    return sorted(by_source.values(), key=lambda x: x.get("relevance_score", 0), reverse=True)


class AgentToolkit:
    """Shared tools available to all maintenance agents."""

    def __init__(self) -> None:
        self.knowledge = KnowledgeEngine()
        self.registry = get_model_registry()
        self.risk_engine = RiskEngine()

    async def search_documents(
        self, query: str, equipment_type: Optional[str] = None, top_k: int = 5
    ) -> dict[str, Any]:
        chunks = self.knowledge.retrieve(query, equipment_type=equipment_type, top_k=top_k)
        return {
            "context": self.knowledge.format_context(chunks),
            "citations": dedupe_citations(
                [
                    {
                        "source": c.metadata.get("source", "unknown"),
                        "document_type": c.metadata.get("document_type", "document"),
                        "excerpt": c.text[:300],
                        "relevance_score": round(c.score, 3),
                    }
                    for c in chunks
                ]
            ),
            "chunk_count": len(chunks),
        }

    async def run_domain_expert(
        self, query: str, equipment_type: Optional[str], sensor_readings: dict[str, float]
    ) -> dict[str, Any]:
        analysis = get_steel_domain_slm().analyze(
            query=query, equipment_type=equipment_type, sensor_readings=sensor_readings
        )
        return analysis.to_dict()

    async def run_ml_prediction(self, sensor_readings: dict[str, float]) -> dict[str, Any]:
        anomaly = self.registry.anomaly_detector.detect(sensor_readings, SENSOR_FEATURES)
        rul = self.registry.rul_predictor.predict(sensor_readings)
        return {
            "anomaly_detected": anomaly.is_anomaly,
            "anomaly_severity": anomaly.severity,
            "failure_probability": rul.failure_probability,
            "rul_cycles": rul.rul_cycles,
            "degradation_score": rul.degradation_score,
        }

    async def get_operational_intel(self, db: AsyncSession, equipment: Optional[Equipment]) -> dict[str, Any]:
        ctx = await operational_context_for_equipment(db, equipment)
        defects = detect_process_defects(
            equipment.equipment_type if equipment else "general",
            await self._latest_sensor_readings(db, equipment.id if equipment else None),
            equipment.equipment_code if equipment else "",
        )
        return {"operational_context": ctx, "process_defects": defects[:5]}

    async def lookup_spare_parts(
        self, db: AsyncSession, equipment_type: Optional[str], high_risk: bool
    ) -> list[dict[str, Any]]:
        query = select(SparePart)
        if equipment_type:
            query = query.where(
                or_(SparePart.equipment_type == equipment_type, SparePart.equipment_type == "general")
            )
        parts = (await db.execute(query)).scalars().all()
        recs = []
        for part in parts:
            stock_low = part.quantity_available < part.minimum_stock
            if not high_risk and not stock_low:
                continue
            recs.append({
                "part": part.name,
                "part_code": part.part_code,
                "quantity_available": part.quantity_available,
                "quantity_recommended": max(1, part.minimum_stock - part.quantity_available + 1),
                "urgency": "critical" if part.quantity_available <= 0 else "high" if stock_low else "medium",
                "lead_time_days": part.lead_time_days,
                "unit_cost": part.unit_cost,
                "rationale": f"Stock {part.quantity_available}/{part.minimum_stock}",
            })
        return recs[:5]

    def assess_risk(
        self,
        *,
        criticality: str,
        failure_probability: float,
        anomaly_severity: str,
        spare_qty: int,
        lead_time: int,
    ) -> dict[str, Any]:
        risk = self.risk_engine.assess(
            equipment_criticality=criticality,
            failure_probability=failure_probability,
            anomaly_severity=anomaly_severity,
            spare_availability=spare_qty,
            lead_time_days=lead_time,
        )
        return {"risk_level": risk.risk_level, "risk_factors": risk.factors, "overall_score": risk.overall_score}

    def build_alerts(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        alerts = []
        if state.get("anomaly_detected"):
            code = state.get("equipment_code", "equipment")
            alerts.append({
                "level": state.get("anomaly_severity", "medium"),
                "title": f"ML anomaly — {code}",
                "message": f"Isolation Forest flagged abnormal sensor pattern on {code}.",
                "source": "anomaly_detector",
            })
        if state.get("failure_probability", 0) >= 0.7:
            fp = state["failure_probability"]
            alerts.append({
                "level": "critical" if fp >= 0.85 else "high",
                "title": "Elevated failure probability",
                "message": f"Failure probability {fp:.0%}, RUL {state.get('rul_cycles')} cycles",
                "source": "predictive_maintenance",
            })
        return alerts

    async def _latest_sensor_readings(self, db: AsyncSession, equipment_id: Optional[int]) -> dict[str, float]:
        if not equipment_id:
            return {}
        row = (
            await db.execute(
                select(SensorData)
                .where(SensorData.equipment_id == equipment_id)
                .order_by(desc(SensorData.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()
        if not row:
            return {}
        return {
            "temperature": row.temperature or 0.0,
            "vibration": row.vibration or 0.0,
            "pressure": row.pressure or 0.0,
            "motor_current": row.motor_current or 0.0,
            "operational_setting_1": row.operational_setting_1 or 0.0,
            "operational_setting_2": row.operational_setting_2 or 0.0,
            "operational_setting_3": row.operational_setting_3 or 0.0,
        }


_toolkit: Optional[AgentToolkit] = None


def get_agent_toolkit() -> AgentToolkit:
    global _toolkit
    if _toolkit is None:
        _toolkit = AgentToolkit()
    return _toolkit
