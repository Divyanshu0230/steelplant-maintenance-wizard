"""Fully agentic LangGraph orchestrator — supervisor autonomously routes specialized agents."""

from __future__ import annotations

import json
import re
from typing import Any, Literal, Optional

from langgraph.graph import END, StateGraph
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.state import AgentState
from app.agents.tools import get_agent_toolkit
from app.core.logging import get_logger
from app.ml.steel_domain_slm import get_steel_domain_slm
from app.models.entities import Equipment, Feedback, SensorData
from app.services.llm_service import LLMService, get_last_ai_mode, get_llm_service

logger = get_logger(__name__)

AGENT_IDS = (
    "run_domain",
    "run_document",
    "run_operational",
    "run_predictive",
    "run_rca",
    "run_planner",
    "run_spares",
    "run_alerts",
    "run_feedback",
)

DEFAULT_AGENT_PLAN = [
    "run_domain",
    "run_document",
    "run_operational",
    "run_predictive",
    "run_rca",
    "run_planner",
    "run_spares",
    "run_alerts",
    "run_feedback",
    "FINISH",
]

MAX_ITERATIONS = 14


class AgenticMaintenanceOrchestrator:
    """Supervisor-driven multi-agent system with autonomous routing and tool use."""

    def __init__(self) -> None:
        self.tools = get_agent_toolkit()
        self._db: Optional[AsyncSession] = None
        self._equipment: Optional[Equipment] = None
        self.graph = self._build_graph()

    @property
    def llm(self):
        return get_llm_service()

    def _build_graph(self):
        workflow = StateGraph(AgentState)
        workflow.add_node("supervisor", self._supervisor)
        workflow.add_node("run_domain", self._agent_domain_slm)
        workflow.add_node("run_document", self._agent_document)
        workflow.add_node("run_operational", self._agent_operational)
        workflow.add_node("run_predictive", self._agent_predictive)
        workflow.add_node("run_rca", self._agent_rca)
        workflow.add_node("run_planner", self._agent_planner)
        workflow.add_node("run_spares", self._agent_spare_parts)
        workflow.add_node("run_alerts", self._agent_alerts)
        workflow.add_node("run_feedback", self._agent_feedback)
        workflow.add_node("synthesizer", self._agent_synthesizer)

        workflow.set_entry_point("supervisor")
        routes = {aid: aid for aid in AGENT_IDS}
        routes["FINISH"] = "synthesizer"
        workflow.add_conditional_edges("supervisor", self._route_supervisor, routes)
        for aid in AGENT_IDS:
            workflow.add_edge(aid, "supervisor")
        workflow.add_edge("synthesizer", END)
        return workflow.compile()

    def _route_supervisor(self, state: AgentState) -> str:
        nxt = state.get("next_agent", "FINISH")
        if nxt == "FINISH":
            return "FINISH"
        if nxt in AGENT_IDS:
            return nxt
        return "run_domain"

    def _trace(self, state: AgentState, agent: str, action: str, detail: str = "") -> None:
        trace = list(state.get("agent_trace") or [])
        trace.append({
            "agent": agent,
            "action": action,
            "detail": detail,
            "iteration": state.get("iteration", 0),
        })
        state["agent_trace"] = trace

    def _mark_done(self, state: AgentState, agent: str) -> None:
        done = list(state.get("completed_agents") or [])
        if agent not in done:
            done.append(agent)
        state["completed_agents"] = done

    async def _supervisor(self, state: AgentState) -> AgentState:
        state["iteration"] = state.get("iteration", 0) + 1
        completed = state.get("completed_agents") or []

        if state["iteration"] > MAX_ITERATIONS:
            state["next_agent"] = "FINISH"
            state["supervisor_reasoning"] = "Max iterations reached — synthesizing answer."
            self._trace(state, "supervisor", "finish", "max_iterations")
            return state

        if "FINISH" in completed or (
            set(AGENT_IDS).issubset(set(completed))
        ):
            state["next_agent"] = "FINISH"
            state["supervisor_reasoning"] = "All specialist agents completed."
            self._trace(state, "supervisor", "finish", "all_agents_done")
            return state

        try:
            plan = await self._supervisor_llm_decision(state)
            state["next_agent"] = plan["next_agent"]
            state["supervisor_reasoning"] = plan.get("reasoning", "")
            state["ai_mode"] = get_last_ai_mode()
        except Exception as exc:
            logger.warning("Supervisor LLM fallback: %s", exc)
            state["next_agent"] = self._supervisor_rule_decision(completed)
            state["supervisor_reasoning"] = f"Rule-based routing (LLM unavailable): {exc}"
            state["ai_mode"] = state.get("ai_mode") or "agentic"

        self._trace(
            state,
            "supervisor",
            "route",
            f"→ {state['next_agent']}: {state['supervisor_reasoning'][:120]}",
        )
        return state

    def _normalize_agent_id(self, agent_id: str, completed: list[str]) -> str:
        aliases = {
            "domain_slm": "run_domain",
            "document_intelligence": "run_document",
            "operational_context": "run_operational",
            "operational_agent": "run_operational",
            "predictive_maintenance": "run_predictive",
            "root_cause_analysis": "run_rca",
            "maintenance_planner": "run_planner",
            "spare_parts": "run_spares",
            "alert_agent": "run_alerts",
            "feedback_learning": "run_feedback",
        }
        nxt = aliases.get(agent_id, agent_id)
        if nxt in completed and nxt != "FINISH":
            return self._supervisor_rule_decision(completed)
        if nxt not in AGENT_IDS and nxt != "FINISH":
            return self._supervisor_rule_decision(completed)
        return nxt

    async def _supervisor_llm_decision(self, state: AgentState) -> dict[str, str]:
        completed = state.get("completed_agents") or []
        system = (
            "You are the Maintenance Wizard Supervisor Agent for a steel plant. "
            "Autonomously decide which specialist agent runs next. "
            "Return JSON only: {\"next_agent\": \"<id>\", \"reasoning\": \"<why>\"}. "
            f"Valid agent ids: {', '.join(AGENT_IDS)}, FINISH. "
            "Choose FINISH only when all specialists have run. Never repeat a completed agent."
        )
        prompt = f"""User query: {state['query']}
Equipment: {state.get('equipment_code')} ({state.get('equipment_type')})
Completed agents: {completed}
Iteration: {state.get('iteration')}
Risk so far: {state.get('risk_level', 'unknown')}
Causes found: {len(state.get('probable_causes') or [])}
Anomaly: {state.get('anomaly_detected')} ({state.get('anomaly_severity')})
What specialist agent should run next?"""
        raw = await self.llm.generate(prompt, system, json_mode=True)
        parsed = LLMService.extract_json(raw)
        nxt = self._normalize_agent_id(parsed.get("next_agent", "run_domain"), completed)
        return {"next_agent": nxt, "reasoning": parsed.get("reasoning", "")}

    def _supervisor_rule_decision(self, completed: list[str]) -> str:
        for step in DEFAULT_AGENT_PLAN:
            if step not in completed:
                return step
        return "FINISH"

    async def _agent_domain_slm(self, state: AgentState) -> AgentState:
        result = await self.tools.run_domain_expert(
            state["query"],
            state.get("equipment_type"),
            state.get("sensor_readings") or {},
        )
        state.update({
            "domain_model_active": result.get("domain_model_active", False),
            "domain_causes": result.get("domain_causes", []),
            "domain_actions": result.get("domain_actions", []),
            "matched_patterns": result.get("matched_patterns", []),
        })
        if result.get("domain_causes"):
            merged = get_steel_domain_slm().merge_causes(
                state.get("probable_causes") or [], 
                get_steel_domain_slm().analyze(
                    state["query"], state.get("equipment_type"), state.get("sensor_readings") or {}
                ),
            )
            state["probable_causes"] = merged
        self._mark_done(state, "run_domain")
        self._trace(state, "domain_slm", "analyze", f"{len(result.get('matched_patterns', []))} patterns")
        return state

    async def _agent_document(self, state: AgentState) -> AgentState:
        doc = await self.tools.search_documents(
            state["query"], state.get("equipment_type"), top_k=5
        )
        state["knowledge_context"] = doc["context"]
        state["citations"] = doc["citations"]
        self._mark_done(state, "run_document")
        self._trace(state, "document_intelligence", "rag_search", f"{doc['chunk_count']} chunks")
        return state

    async def _agent_operational(self, state: AgentState) -> AgentState:
        intel = await self.tools.get_operational_intel(self._db, self._equipment)
        state["operational_context"] = intel["operational_context"]
        state["process_defects"] = intel["process_defects"]
        self._mark_done(state, "run_operational")
        self._trace(state, "operational_agent", "fetch_logs", f"{len(intel['process_defects'])} defects")
        return state

    async def _agent_predictive(self, state: AgentState) -> AgentState:
        ml = await self.tools.run_ml_prediction(state.get("sensor_readings") or {})
        state.update(ml)
        spares = state.get("spare_recommendations") or []
        spare_qty = spares[0].get("quantity_available", 0) if spares else 0
        lead = spares[0].get("lead_time_days", 7) if spares else 7
        risk = self.tools.assess_risk(
            criticality=state.get("equipment_criticality", "medium"),
            failure_probability=ml.get("failure_probability", 0),
            anomaly_severity=ml.get("anomaly_severity", "low"),
            spare_qty=spare_qty,
            lead_time=lead,
        )
        state["risk_level"] = risk["risk_level"]
        state["risk_factors"] = risk["risk_factors"]
        self._mark_done(state, "run_predictive")
        self._trace(
            state, "predictive_maintenance", "ml_scan",
            f"RUL {ml.get('rul_cycles')} | risk {risk['risk_level']}",
        )
        return state

    async def _agent_rca(self, state: AgentState) -> AgentState:
        system = (
            "You are the RCA Agent — senior steel plant maintenance engineer. "
            "Return JSON: probable_causes list of {cause, confidence (0-1), evidence}."
        )
        prompt = f"""Query: {state['query']}
Equipment: {state.get('equipment_code')} | Sensors: {json.dumps(state.get('sensor_readings', {}))}
Domain expert: {json.dumps(state.get('domain_causes', [])[:3])}
Operational: {str(state.get('operational_context', ''))[:800]}
Knowledge: {str(state.get('knowledge_context', ''))[:2000]}
ML: anomaly={state.get('anomaly_detected')} RUL={state.get('rul_cycles')} fail_prob={state.get('failure_probability')}
Feedback: {state.get('feedback_context', 'None')}"""
        try:
            raw = await self.llm.generate(prompt, system, json_mode=True)
            parsed = LLMService.extract_json(raw)
            causes = self._normalize_causes(parsed.get("probable_causes", []))
            state["ai_mode"] = get_last_ai_mode()
        except Exception as exc:
            causes = self._rca_fallback(state)
            state["ai_mode"] = state.get("ai_mode") or "agentic"
            self._trace(state, "root_cause_analysis", "fallback", str(exc)[:80])

        if state.get("domain_causes"):
            analysis = get_steel_domain_slm().analyze(
                state["query"], state.get("equipment_type"), state.get("sensor_readings") or {}
            )
            causes = get_steel_domain_slm().merge_causes(causes, analysis)

        state["probable_causes"] = causes
        state["confidence_score"] = max((c.get("confidence", 0.5) for c in causes), default=0.5)
        self._mark_done(state, "run_rca")
        self._trace(state, "root_cause_analysis", "diagnose", f"{len(causes)} causes")
        return state

    def _rca_fallback(self, state: AgentState) -> list[dict[str, Any]]:
        causes = list(state.get("domain_causes") or [])
        if not causes and state.get("anomaly_detected"):
            causes.append({
                "cause": "Sensor anomaly pattern detected by ML",
                "confidence": 0.8,
                "evidence": f"Severity {state.get('anomaly_severity')}",
            })
        if not causes:
            causes.append({
                "cause": "General equipment degradation",
                "confidence": 0.5,
                "evidence": "ML + sensor profile",
            })
        return causes

    async def _agent_planner(self, state: AgentState) -> AgentState:
        system = (
            "You are the Maintenance Planner Agent. "
            "Return JSON: maintenance_actions list of {priority, action, timeframe, rationale}."
        )
        prompt = f"""Equipment: {state.get('equipment_code')}
Causes: {json.dumps(state.get('probable_causes', [])[:4])}
Risk: {state.get('risk_level')} | RUL: {state.get('rul_cycles')}
Domain actions: {json.dumps(state.get('domain_actions', [])[:3])}
SOPs: {str(state.get('knowledge_context', ''))[:1500]}"""
        actions: list[dict[str, Any]] = []
        try:
            raw = await self.llm.generate(prompt, system, json_mode=True)
            parsed = LLMService.extract_json(raw)
            actions = parsed.get("maintenance_actions", [])
        except Exception:
            priority = "immediate" if state.get("risk_level") in ("high", "critical") else "short-term"
            actions = [{
                "priority": priority,
                "action": "Inspect equipment and verify readings against SOP",
                "timeframe": "Within 4 hours" if priority == "immediate" else "Within 24 hours",
                "rationale": f"Risk {state.get('risk_level')}",
            }]

        for da in state.get("domain_actions") or []:
            key = (da.get("action") or "")[:40].lower()
            if not any((a.get("action") or "")[:40].lower() == key for a in actions):
                actions.insert(0, da)

        state["maintenance_actions"] = actions
        self._mark_done(state, "run_planner")
        self._trace(state, "maintenance_planner", "plan", f"{len(actions)} actions")
        return state

    async def _agent_spare_parts(self, state: AgentState) -> AgentState:
        high_risk = (
            state.get("anomaly_severity") in ("high", "critical")
            or state.get("failure_probability", 0) > 0.5
        )
        recs = await self.tools.lookup_spare_parts(
            self._db, state.get("equipment_type"), high_risk
        )
        state["spare_recommendations"] = recs
        self._mark_done(state, "run_spares")
        self._trace(state, "spare_parts", "inventory", f"{len(recs)} recommendations")
        return state

    async def _agent_alerts(self, state: AgentState) -> AgentState:
        state["alerts"] = self.tools.build_alerts(state)
        self._mark_done(state, "run_alerts")
        self._trace(state, "alert_agent", "generate", f"{len(state['alerts'])} alerts")
        return state

    async def _agent_feedback(self, state: AgentState) -> AgentState:
        from app.services.feedback_learning import get_feedback_learning

        learning = get_feedback_learning()
        eq_id = state.get("equipment_id")
        adjusted = []
        for c in state.get("probable_causes") or []:
            conf = learning.adjust_confidence(c.get("cause", ""), float(c.get("confidence", 0.5)), eq_id)
            adjusted.append({**c, "confidence": conf})
        state["probable_causes"] = adjusted
        if adjusted:
            state["confidence_score"] = max(c.get("confidence", 0.5) for c in adjusted)
        if self._db:
            state["feedback_context"] = await learning.get_context(self._db, eq_id)
        self._mark_done(state, "run_feedback")
        self._trace(state, "feedback_learning", "apply", "confidence adjusted")
        return state

    async def _agent_synthesizer(self, state: AgentState) -> AgentState:
        """Final synthesis agent — composes the user-facing answer."""
        query = state["query"]
        history_snip = ""
        if state.get("conversation_history"):
            history_snip = "\n".join(
                f"{m['role']}: {m['content'][:300]}"
                for m in state["conversation_history"][-4:]
            )

        focus = "Answer the engineer's specific question directly."
        q_lower = query.lower()
        if re.search(r"\bspare\b|\bparts?\b|\border\b", q_lower):
            focus = (
                "Focus on SPARE PARTS: list recommended parts, quantities, lead times, and stock. "
                "Do not repeat a generic fault summary."
            )
        elif re.search(r"\bsop\b|\bmanual\b|\bsection\b|\brelevant\b", q_lower):
            focus = (
                "Focus on SOP/MANUAL: cite relevant procedure excerpts and which manual sections apply. "
                "Do not repeat a generic fault summary."
            )
        elif re.search(r"\bsafe\b|\bkeep\s+running\b|\bshutdown\b", q_lower):
            focus = "Focus on SAFETY: clear run/stop recommendation with justification."

        prompt = f"""{focus}

User question: {query}
Equipment: {state.get('equipment_code')} at {state.get('equipment_location')}
Causes: {json.dumps(state.get('probable_causes', [])[:4])}
Actions: {json.dumps(state.get('maintenance_actions', [])[:4])}
Spares: {json.dumps(state.get('spare_recommendations', [])[:6])}
Manual excerpts: {json.dumps([c.get('excerpt', '')[:200] for c in (state.get('citations') or [])[:3]])}
Risk: {state.get('risk_level')} | RUL: {state.get('rul_cycles')} | Failure: {state.get('failure_probability')}
Recent chat:
{history_snip or '(none)'}"""

        try:
            answer = await self.llm.generate(
                prompt,
                "You are the Synthesizer Agent for Tata Steel maintenance. "
                "Answer ONLY what was asked. Use bullet lists. Be specific to the equipment.",
                history=state.get("conversation_history"),
            )
            from app.services.llm_service import get_last_ai_mode

            mode = get_last_ai_mode()
            state["ai_mode"] = mode if mode not in ("unknown", "offline") else "agentic"
        except Exception:
            # Agents + ML completed — still Agentic AI pipeline (not a generic offline banner)
            state["ai_mode"] = "agentic"
            answer = ""  # query-specific formatter will build from structured state

        state["final_answer"] = answer
        state["report_summary"] = answer
        self._trace(state, "synthesizer", "compose", f"mode={state.get('ai_mode')}")
        return state

    def _normalize_causes(self, causes: list[dict]) -> list[dict]:
        out = []
        for c in causes:
            conf = c.get("confidence", 0.5)
            if isinstance(conf, str):
                conf_map = {"low": 0.3, "medium": 0.5, "high": 0.85, "critical": 0.95}
                conf = conf_map.get(conf.lower(), 0.5)
            out.append({**c, "confidence": float(conf)})
        return out

    async def run(
        self,
        db: AsyncSession,
        query: str,
        equipment_id: Optional[int] = None,
        equipment_code: Optional[str] = None,
        conversation_history: Optional[list[dict[str, str]]] = None,
    ) -> AgentState:
        self._db = db
        equipment = await self._resolve_equipment(db, equipment_id, equipment_code)
        self._equipment = equipment
        sensor_readings = await self._load_sensor_readings(db, equipment)

        history_text = ""
        if conversation_history:
            history_text = "\n".join(
                f"{m['role']}: {m['content'][:400]}" for m in conversation_history[-6:]
            )

        feedback_ctx = await self._load_feedback_context(db, equipment.id if equipment else None)

        initial: AgentState = {
            "query": query,
            "equipment_id": equipment.id if equipment else None,
            "equipment_code": equipment.equipment_code if equipment else equipment_code,
            "equipment_name": equipment.name if equipment else None,
            "equipment_location": equipment.location if equipment else None,
            "equipment_type": equipment.equipment_type if equipment else None,
            "equipment_criticality": equipment.criticality if equipment else "medium",
            "sensor_readings": sensor_readings,
            "conversation_history": conversation_history or [],
            "conversation_context": history_text,
            "citations": [],
            "probable_causes": [],
            "maintenance_actions": [],
            "spare_recommendations": [],
            "alerts": [],
            "failure_probability": 0.0,
            "rul_cycles": 100,
            "degradation_score": 0.0,
            "anomaly_detected": False,
            "anomaly_severity": "low",
            "risk_level": "medium",
            "risk_factors": {},
            "confidence_score": 0.0,
            "feedback_context": feedback_ctx,
            "operational_context": "",
            "process_defects": [],
            "iteration": 0,
            "completed_agents": [],
            "agent_trace": [],
            "next_agent": "run_domain",
            "supervisor_reasoning": "Starting agentic maintenance workflow",
            "ai_mode": "agentic",
            "data_source": await self._data_source(db, equipment),
        }
        return await self.graph.ainvoke(initial)

    async def _resolve_equipment(self, db, equipment_id, equipment_code):
        if equipment_id:
            return (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
        if equipment_code:
            return (await db.execute(select(Equipment).where(Equipment.equipment_code == equipment_code))).scalar_one_or_none()
        return None

    async def _load_sensor_readings(self, db, equipment) -> dict[str, float]:
        if not equipment:
            return {}
        row = (
            await db.execute(
                select(SensorData)
                .where(SensorData.equipment_id == equipment.id)
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

    async def _data_source(self, db, equipment) -> str:
        if not equipment:
            return "plant_sensors"
        row = (
            await db.execute(
                select(SensorData)
                .where(SensorData.equipment_id == equipment.id)
                .order_by(desc(SensorData.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()
        if row and row.metadata_:
            return row.metadata_.get("source", "plant_sensors")
        return "plant_sensors"

    async def _load_feedback_context(self, db, equipment_id):
        q = select(Feedback).order_by(desc(Feedback.created_at)).limit(5)
        if equipment_id:
            q = q.where(Feedback.equipment_id == equipment_id)
        rows = (await db.execute(q)).scalars().all()
        if not rows:
            return "None"
        return "\n".join(
            f"- {r.feedback_type}: {r.correction or r.original_recommendation or 'N/A'}" for r in rows
        )


_orchestrator: Optional[AgenticMaintenanceOrchestrator] = None


def get_orchestrator() -> AgenticMaintenanceOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = AgenticMaintenanceOrchestrator()
    return _orchestrator
