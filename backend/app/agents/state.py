from typing import Any, Optional, TypedDict


class AgentState(TypedDict, total=False):
    query: str
    equipment_id: Optional[int]
    equipment_code: Optional[str]
    equipment_name: Optional[str]
    equipment_location: Optional[str]
    equipment_type: Optional[str]
    equipment_criticality: str
    sensor_readings: dict[str, float]
    knowledge_context: str
    citations: list[dict[str, Any]]
    probable_causes: list[dict[str, Any]]
    failure_probability: float
    rul_cycles: int
    degradation_score: float
    anomaly_detected: bool
    anomaly_severity: str
    risk_level: str
    risk_factors: dict[str, float]
    maintenance_actions: list[dict[str, Any]]
    spare_recommendations: list[dict[str, Any]]
    alerts: list[dict[str, Any]]
    report_summary: str
    final_answer: str
    confidence_score: float
    feedback_context: str
    conversation_history: str
    model_version: str
    # Agentic fields
    next_agent: str
    iteration: int
    completed_agents: list[str]
    agent_trace: list[dict[str, Any]]
    supervisor_reasoning: str
    operational_context: str
    process_defects: list[dict[str, Any]]
    domain_model_active: bool
    domain_causes: list[dict[str, Any]]
    domain_actions: list[dict[str, Any]]
    matched_patterns: list[str]
    ai_mode: str
    data_source: str
