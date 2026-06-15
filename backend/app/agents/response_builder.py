"""Map agentic LangGraph state to API response shape."""

from typing import Any

from app.agents.state import AgentState


def agent_state_to_response(state: AgentState) -> dict[str, Any]:
    """Normalize AgentState for chat/diagnosis/reports consumers."""
    return {
        "ai_mode": state.get("ai_mode", "agentic"),
        "equipment_id": state.get("equipment_id"),
        "equipment_code": state.get("equipment_code"),
        "equipment_name": state.get("equipment_name"),
        "equipment_location": state.get("equipment_location"),
        "equipment_criticality": state.get("equipment_criticality"),
        "sensor_readings": state.get("sensor_readings", {}),
        "data_source": state.get("data_source", "plant_sensors"),
        "final_answer": state.get("final_answer") or state.get("report_summary", ""),
        "probable_causes": state.get("probable_causes", []),
        "maintenance_actions": state.get("maintenance_actions", []),
        "spare_recommendations": state.get("spare_recommendations", []),
        "citations": state.get("citations", []),
        "alerts": state.get("alerts", []),
        "risk_level": state.get("risk_level", "medium"),
        "risk_factors": state.get("risk_factors", {}),
        "failure_probability": state.get("failure_probability"),
        "rul_cycles": state.get("rul_cycles"),
        "degradation_score": state.get("degradation_score"),
        "anomaly_detected": state.get("anomaly_detected", False),
        "confidence_score": state.get("confidence_score", 0.5),
        "process_defects": state.get("process_defects", []),
        "operational_context": state.get("operational_context", ""),
        "domain_model_active": state.get("domain_model_active", False),
        "domain_causes": state.get("domain_causes", []),
        "domain_actions": state.get("domain_actions", []),
        "matched_patterns": state.get("matched_patterns", []),
        "agent_trace": state.get("agent_trace", []),
        "completed_agents": state.get("completed_agents", []),
        "supervisor_reasoning": state.get("supervisor_reasoning", ""),
        "agentic": True,
    }
