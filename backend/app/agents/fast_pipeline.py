"""Fast single-LLM maintenance pipeline — 1 Gemini call instead of 3."""

import json
from typing import Any, Optional

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.tools import dedupe_citations
from app.ml.model_registry import get_model_registry
from app.ml.risk_engine import RiskEngine
from app.ml.rul_predictor import SENSOR_FEATURES
from app.models.entities import Equipment, Feedback, SensorData, SparePart
from app.rag.knowledge_engine import KnowledgeEngine
from app.services.llm_service import LLMService, get_llm_service


class FastMaintenancePipeline:
    """Optimized pipeline: RAG + ML + 1 LLM call."""

    def __init__(self) -> None:
        self.knowledge = KnowledgeEngine()
        self.registry = get_model_registry()
        self.risk_engine = RiskEngine()

    async def run(
        self,
        db: AsyncSession,
        query: str,
        equipment_id: Optional[int] = None,
        equipment_code: Optional[str] = None,
        conversation_history: Optional[list[dict[str, str]]] = None,
    ) -> dict[str, Any]:
        equipment = await self._resolve_equipment(db, equipment_id, equipment_code)
        sensor_readings = await self._latest_sensor_readings(
            db, equipment.id if equipment else None
        )

        chunks = self.knowledge.retrieve(
            query,
            equipment_type=equipment.equipment_type if equipment else None,
            top_k=3,
        )
        knowledge_context = self.knowledge.format_context(chunks)
        citations = dedupe_citations(
            [
                {
                    "source": c.metadata.get("source", "unknown"),
                    "document_type": c.metadata.get("document_type", "document"),
                    "excerpt": c.text[:200],
                    "relevance_score": round(c.score, 3),
                }
                for c in chunks
            ]
        )

        anomaly = self.registry.anomaly_detector.detect(sensor_readings, SENSOR_FEATURES)
        rul = self.registry.rul_predictor.predict(sensor_readings)

        spare_recs = await self._spare_recommendations(
            db,
            equipment.equipment_type if equipment else None,
            anomaly.severity,
            rul.failure_probability,
        )
        spare_qty = spare_recs[0].get("quantity_available", 0) if spare_recs else 0
        lead_time = spare_recs[0].get("lead_time_days", 7) if spare_recs else 7

        downtime_recent = 0.0
        if equipment:
            from app.services.operational_service import recent_downtime_hours
            downtime_recent = await recent_downtime_hours(db, equipment.id)

        risk = self.risk_engine.assess(
            equipment_criticality=equipment.criticality if equipment else "medium",
            failure_probability=rul.failure_probability,
            anomaly_severity=anomaly.severity,
            spare_availability=spare_qty,
            lead_time_days=lead_time,
            downtime_hours_recent=downtime_recent,
        )

        from app.services.feedback_learning import get_feedback_learning
        from app.services.operational_service import operational_context_for_equipment
        from app.services.process_defect_service import detect_process_defects

        feedback_ctx = await get_feedback_learning().get_context(
            db, equipment.id if equipment else None
        )
        operational_ctx = await operational_context_for_equipment(db, equipment)
        process_defects = detect_process_defects(
            equipment.equipment_type if equipment else "general",
            sensor_readings,
            equipment.equipment_code if equipment else (equipment_code or ""),
        )

        from app.ml.steel_domain_slm import get_steel_domain_slm

        domain_slm = get_steel_domain_slm()
        domain_analysis = domain_slm.analyze(
            query=query,
            equipment_type=equipment.equipment_type if equipment else None,
            sensor_readings=sensor_readings,
        )
        domain_ctx = domain_analysis.prompt_context or "No domain pattern match yet."

        llm_error: Optional[str] = None
        llm = get_llm_service()
        prompt = f"""Analyze this maintenance query for a steel plant.

Query: {query}
Equipment: {equipment.equipment_code if equipment else equipment_code} ({equipment.equipment_type if equipment else 'general'})
Criticality: {equipment.criticality if equipment else 'medium'}
Sensor readings: {json.dumps(sensor_readings)}
Anomaly detected: {anomaly.is_anomaly} (severity: {anomaly.severity})
RUL cycles: {rul.rul_cycles} | Failure probability: {rul.failure_probability:.0%}
Risk level: {risk.risk_level}

Operational delay logs & SCADA fault messages:
{operational_ctx}

Process-related defects detected:
{json.dumps(process_defects[:3])}

Knowledge from manuals/SOPs:
{knowledge_context[:2500]}

Prior engineer feedback:
{feedback_ctx}

Domain-adapted steel expert (fine-tuned SLM layer):
{domain_ctx}

Conversation so far:
{self._format_history(conversation_history)}

Return JSON with these keys:
- answer: concise helpful response (2-4 paragraphs)
- probable_causes: list of {{cause, confidence (0-1 number), evidence}}
- maintenance_actions: list of {{priority, action, timeframe, rationale}}
"""
        system = (
            "You are SteelPlant Maintenance Wizard with a domain-adapted steel maintenance expert layer. "
            "Prioritize domain expert preliminary causes when sensor evidence aligns. "
            "Be concise and actionable. Return valid JSON only."
        )
        parsed: dict[str, Any] = {}
        from app.services.llm_service import get_last_ai_mode

        try:
            response = await llm.generate(
                prompt, system, json_mode=True, history=conversation_history
            )
            parsed = LLMService.extract_json(response)
            ai_mode = get_last_ai_mode()
        except Exception as exc:
            llm_error = str(exc)
            parsed = self._fallback_analysis(
                query=query,
                equipment_code=equipment.equipment_code if equipment else equipment_code,
                sensor_readings=sensor_readings,
                anomaly=anomaly,
                rul=rul,
                risk=risk,
                knowledge_context=knowledge_context,
                conversation_history=conversation_history,
            )
            ai_mode = state.get("ai_mode") or "agentic"

        from app.services.feedback_learning import get_feedback_learning
        learning = get_feedback_learning()
        eq_id = equipment.id if equipment else None
        causes = []
        for c in parsed.get("probable_causes", []):
            conf = c.get("confidence", 0.5)
            if isinstance(conf, str):
                conf_map = {"low": 0.3, "medium": 0.5, "high": 0.85, "critical": 0.95}
                conf = conf_map.get(conf.lower(), 0.5)
            conf = learning.adjust_confidence(c.get("cause", ""), float(conf), eq_id)
            causes.append({**c, "confidence": conf})

        causes = domain_slm.merge_causes(causes, domain_analysis)
        domain_actions = [
            {
                "priority": a.priority,
                "action": a.action,
                "timeframe": a.timeframe,
                "rationale": a.rationale,
                "source": "steel_domain_slm",
            }
            for a in domain_analysis.domain_actions
        ]
        actions = parsed.get("maintenance_actions", [])
        seen_actions = {(a.get("action") or "").lower()[:40] for a in actions}
        for da in domain_actions:
            if (da.get("action") or "").lower()[:40] not in seen_actions:
                actions.insert(0, da)
                seen_actions.add((da.get("action") or "").lower()[:40])
        answer = parsed.get("answer") or parsed.get("summary", "")
        if not answer:
            answer = self._format_fallback_answer(
                query, equipment, anomaly, rul, risk, causes, actions, llm_error
            )

        alerts = []
        if anomaly.is_anomaly:
            eq_code = equipment.equipment_code if equipment else equipment_code
            alerts.append({
                "level": anomaly.severity,
                "title": f"ML anomaly — {eq_code}",
                "message": f"Isolation Forest flagged abnormal sensor pattern on {eq_code}.",
                "source": "anomaly_detector",
            })
        if rul.failure_probability >= 0.7:
            alerts.append({
                "level": "critical" if rul.failure_probability >= 0.85 else "high",
                "title": "Elevated failure probability",
                "message": f"Failure probability {rul.failure_probability:.0%}, RUL {rul.rul_cycles} cycles",
                "source": "predictive_maintenance",
            })

        confidence = max((c.get("confidence", 0.5) for c in causes), default=0.5)

        data_source = "plant_sensors"
        if equipment_id:
            r2 = await db.execute(
                select(SensorData).where(SensorData.equipment_id == equipment_id)
                .order_by(desc(SensorData.timestamp)).limit(1)
            )
            latest_row = r2.scalar_one_or_none()
            if latest_row and latest_row.metadata_:
                data_source = latest_row.metadata_.get("source", "plant_sensors")

        return {
            "ai_mode": ai_mode,
            "equipment_id": equipment.id if equipment else None,
            "equipment_code": equipment.equipment_code if equipment else equipment_code,
            "equipment_name": equipment.name if equipment else None,
            "equipment_location": equipment.location if equipment else None,
            "equipment_criticality": equipment.criticality if equipment else None,
            "sensor_readings": sensor_readings,
            "data_source": data_source,
            "final_answer": answer,
            "probable_causes": causes,
            "maintenance_actions": actions,
            "spare_recommendations": spare_recs,
            "citations": citations,
            "alerts": alerts,
            "risk_level": risk.risk_level,
            "risk_factors": risk.factors,
            "failure_probability": rul.failure_probability,
            "rul_cycles": rul.rul_cycles,
            "degradation_score": rul.degradation_score,
            "anomaly_detected": anomaly.is_anomaly,
            "confidence_score": confidence,
            "process_defects": process_defects,
            "operational_context": operational_ctx,
            **domain_analysis.to_dict(),
        }

    async def _resolve_equipment(self, db, equipment_id, equipment_code):
        if equipment_id:
            r = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
            return r.scalar_one_or_none()
        if equipment_code:
            r = await db.execute(select(Equipment).where(Equipment.equipment_code == equipment_code))
            return r.scalar_one_or_none()
        return None

    async def _latest_sensor_readings(self, db, equipment_id):
        if not equipment_id:
            return {}
        r = await db.execute(
            select(SensorData).where(SensorData.equipment_id == equipment_id)
            .order_by(desc(SensorData.timestamp)).limit(1)
        )
        row = r.scalar_one_or_none()
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

    async def _spare_recommendations(self, db, equipment_type, anomaly_severity, failure_prob):
        if not equipment_type:
            return []
        r = await db.execute(
            select(SparePart).where(
                or_(SparePart.equipment_type == equipment_type, SparePart.equipment_type == "general")
            )
        )
        parts = r.scalars().all()
        high_risk = anomaly_severity in ("high", "critical") or failure_prob > 0.5
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

    @staticmethod
    def _format_history(history: Optional[list[dict[str, str]]]) -> str:
        if not history:
            return "None"
        return "\n".join(
            f"{m['role']}: {m['content'][:300]}" for m in history[-6:]
        )

    def _fallback_analysis(
        self,
        *,
        query: str,
        equipment_code: Optional[str],
        sensor_readings: dict,
        anomaly,
        rul,
        risk,
        knowledge_context: str,
        conversation_history: Optional[list[dict[str, str]]] = None,
    ) -> dict[str, Any]:
        """Rule-based analysis when Gemini is unavailable."""
        causes = []
        q = query.lower()
        if "vibrat" in q:
            causes.append({
                "cause": "Mechanical imbalance or bearing wear",
                "confidence": 0.75,
                "evidence": f"Vibration reading {sensor_readings.get('vibration', 'N/A')}",
            })
        if "temperat" in q or "overheat" in q or "hot" in q:
            causes.append({
                "cause": "Cooling system fault or excessive load",
                "confidence": 0.7,
                "evidence": f"Temperature {sensor_readings.get('temperature', 'N/A')}",
            })
        if "current" in q or "motor" in q:
            causes.append({
                "cause": "Motor overload or winding degradation",
                "confidence": 0.65,
                "evidence": f"Motor current {sensor_readings.get('motor_current', 'N/A')}",
            })
        if anomaly.is_anomaly:
            causes.append({
                "cause": "Sensor anomaly pattern detected by ML model",
                "confidence": 0.8,
                "evidence": f"Anomaly severity: {anomaly.severity}",
            })
        if not causes:
            causes.append({
                "cause": "General equipment degradation",
                "confidence": 0.5,
                "evidence": "Based on current sensor profile",
            })

        priority = "immediate" if risk.risk_level in ("high", "critical") else "short-term"
        actions = [
            {
                "priority": priority,
                "action": "Inspect equipment and verify sensor readings against SOP thresholds",
                "timeframe": "Within 4 hours" if priority == "immediate" else "Within 24 hours",
                "rationale": f"Risk level is {risk.risk_level}",
            },
            {
                "priority": "short-term",
                "action": "Schedule vibration/thermal analysis per maintenance manual",
                "timeframe": "Within 48 hours",
                "rationale": f"RUL estimate: {rul.rul_cycles} cycles",
            },
        ]
        if rul.failure_probability >= 0.6:
            actions.insert(0, {
                "priority": "immediate",
                "action": "Plan preventive shutdown and component replacement",
                "timeframe": "Before next production cycle",
                "rationale": f"Failure probability {rul.failure_probability:.0%}",
            })

        if any(w in q for w in ("safe", "shutdown", "stop", "continue", "run", "keep")):
            urgent = risk.risk_level in ("high", "critical") or rul.failure_probability >= 0.7
            actions.insert(0, {
                "priority": "immediate" if urgent else "short-term",
                "action": (
                    "Controlled shutdown and inspection before continued operation"
                    if urgent
                    else "Continue with enhanced monitoring and scheduled inspection"
                ),
                "timeframe": "Before next production cycle" if urgent else "Within 24 hours",
                "rationale": f"Risk {risk.risk_level}, failure probability {rul.failure_probability:.0%}",
            })

        excerpt = knowledge_context[:400] if knowledge_context else ""
        prior_user_msgs = [
            m["content"] for m in (conversation_history or [])
            if m.get("role") == "user"
        ][-3:]
        prior_assistant = [
            m["content"] for m in (conversation_history or [])
            if m.get("role") == "assistant"
        ][-1:]

        has_prior_exchange = bool(conversation_history) and any(
            m.get("role") == "assistant" for m in conversation_history
        )
        q_lower = query.lower()
        if any(w in q_lower for w in ("safe", "shutdown", "stop", "continue", "run", "keep")):
            urgent = risk.risk_level in ("high", "critical") or rul.failure_probability >= 0.7
            answer = (
                f"**Safety assessment for {equipment_code or 'equipment'}:**\n\n"
                f"{'**Not recommended** to keep running without inspection. Plan a controlled shutdown.' if urgent else '**Acceptable to continue** with enhanced monitoring and a near-term inspection window.'}\n\n"
                f"- Risk level: **{risk.risk_level.upper()}**\n"
                f"- Failure probability: **{rul.failure_probability:.0%}**\n"
                f"- RUL estimate: **{rul.rul_cycles} cycles**\n"
                f"- Top concern: {causes[0]['cause']}\n\n"
                f"**Recommended:** {actions[0]['action']} ({actions[0]['timeframe']}).\n\n"
            )
        elif has_prior_exchange:
            answer = self._build_followup_answer(
                query=query,
                equipment_code=equipment_code,
                prior_topics=prior_user_msgs[:-1],
                last_reply=prior_assistant[0] if prior_assistant else "",
                risk=risk,
                rul=rul,
                anomaly=anomaly,
                causes=causes,
                actions=actions,
                excerpt=excerpt,
            )
        else:
            answer = (
                f"Analysis for {equipment_code or 'equipment'}:\n\n"
                f"Risk: {risk.risk_level.upper()}. "
                f"Failure probability {rul.failure_probability:.0%}, RUL ~{rul.rul_cycles} cycles. "
                f"{'Anomaly detected' if anomaly.is_anomaly else 'Sensors within expected range'}.\n\n"
                f"Top probable cause: {causes[0]['cause']}. "
                f"Recommended: {actions[0]['action']} ({actions[0]['timeframe']}).\n\n"
            )
            if excerpt:
                answer += f"\n\nRelevant manual excerpt:\n{excerpt[:300]}"

        return {
            "answer": answer,
            "probable_causes": causes,
            "maintenance_actions": actions,
        }

    def _build_followup_answer(
        self,
        *,
        query: str,
        equipment_code: Optional[str],
        prior_topics: list[str],
        last_reply: str,
        risk,
        rul,
        anomaly,
        causes: list,
        actions: list,
        excerpt: str,
    ) -> str:
        """Natural multi-turn reply when Gemini is rate-limited."""
        q = query.lower().strip()
        code = equipment_code or "equipment"
        lines = [f"Following up on {code}:"]

        if any(w in q for w in ("why", "explain", "how", "what do you mean", "clarify")):
            lines.append(
                f"You asked about \"{query}\". Based on our earlier discussion "
                f"({'; '.join(t[:60] for t in prior_topics[-2:])}), "
                f"the main issue points to {causes[0]['cause']}. "
                f"Evidence: {causes[0]['evidence']}."
            )
        elif any(w in q for w in ("next", "then", "after", "step", "should i")):
            lines.append(
                f"Next steps for {code}: {actions[0]['action']} ({actions[0]['timeframe']}). "
            )
            if len(actions) > 1:
                lines.append(f"Then: {actions[1]['action']} ({actions[1]['timeframe']}).")
        elif any(w in q for w in ("spare", "part", "stock", "procure", "order")):
            lines.append(
                "Check Spare Parts inventory for low-stock items linked to this equipment. "
                "Use the Request button to create a procurement ticket."
            )
        elif any(w in q for w in ("safe", "shutdown", "stop", "continue", "run")):
            urgent = risk.risk_level in ("high", "critical") or rul.failure_probability >= 0.7
            lines.append(
                f"{'Recommend controlled shutdown and inspection before continued operation.' if urgent else 'Continued operation is acceptable with enhanced monitoring.'} "
                f"Risk: {risk.risk_level}, failure probability {rul.failure_probability:.0%}."
            )
        else:
            lines.append(
                f"Regarding \"{query}\": risk remains {risk.risk_level.upper()}, "
                f"RUL ~{rul.rul_cycles} cycles. "
                f"Primary cause still {causes[0]['cause']}. "
                f"Action: {actions[0]['action']}."
            )

        if last_reply and len(last_reply) > 20:
            lines.append("\n(Context from previous analysis retained in this conversation.)")
        if excerpt:
            lines.append(f"\nManual reference:\n{excerpt[:250]}")
        return "\n".join(lines)

    def _format_fallback_answer(self, query, equipment, anomaly, rul, risk, causes, actions, llm_error):
        code = equipment.equipment_code if equipment else "equipment"
        top_cause = causes[0]["cause"] if causes else "undetermined"
        top_action = actions[0]["action"] if actions else "inspect per SOP"
        return (
            f"Maintenance assessment for {code}.\n\n"
            f"Query: {query}\n"
            f"Risk: {risk.risk_level}. Failure probability {rul.failure_probability:.0%}. "
            f"RUL ~{rul.rul_cycles} cycles.\n"
            f"Likely cause: {top_cause}.\n"
            f"Recommended action: {top_action}."
        )

    async def _load_feedback_context(self, db, equipment_id):
        q = select(Feedback).order_by(desc(Feedback.created_at)).limit(3)
        if equipment_id:
            q = q.where(Feedback.equipment_id == equipment_id)
        r = await db.execute(q)
        rows = r.scalars().all()
        if not rows:
            return "None"
        return "\n".join(f"- {row.correction or row.feedback_type}" for row in rows)


_pipeline: Optional[FastMaintenancePipeline] = None


def get_fast_pipeline() -> FastMaintenancePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = FastMaintenancePipeline()
    return _pipeline
