from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str
    role_name: str = "engineer"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role_name: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class EquipmentResponse(BaseModel):
    id: int
    equipment_code: str
    name: str
    equipment_type: str
    location: Optional[str] = None
    criticality: str
    status: str

    model_config = {"from_attributes": True}


class EquipmentCreate(BaseModel):
    equipment_code: str
    name: str
    equipment_type: str
    location: Optional[str] = None
    criticality: str = "medium"
    manufacturer: Optional[str] = None
    model: Optional[str] = None


class HealthScoreResponse(BaseModel):
    equipment_id: int
    equipment_code: str
    equipment_name: str
    health_score: float
    anomaly_score: Optional[float] = None
    risk_level: str
    failure_probability: Optional[float] = None
    rul_cycles: Optional[int] = None


ALERT_RESOLUTION_TYPES = (
    "spare_replacement",
    "adjustment_calibration",
    "maintenance_action",
    "false_alarm",
    "operator_intervention",
    "other",
)


class AlertResolveRequest(BaseModel):
    resolution_type: str
    resolution_notes: Optional[str] = None


class AlertResponse(BaseModel):
    id: int
    equipment_id: Optional[int] = None
    alert_level: str
    title: str
    message: str
    source: Optional[str] = None
    is_acknowledged: bool
    is_resolved: bool = False
    resolution_type: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    current_page: Optional[str] = None
    chat_mode: str = "assistant"  # assistant | diagnosis
    use_full_agents: bool = False  # True = 9-agent LangGraph (many LLM calls)


class Citation(BaseModel):
    source: str
    document_type: str
    excerpt: str
    relevance_score: float


class MaintenanceAction(BaseModel):
    priority: str
    action: str
    timeframe: str
    rationale: str


class ChatResponse(BaseModel):
    conversation_id: int
    answer: str
    probable_causes: list[dict[str, Any]] = []
    risk_level: str = "medium"
    failure_probability: Optional[float] = None
    rul_cycles: Optional[int] = None
    maintenance_actions: list[MaintenanceAction] = []
    spare_recommendations: list[dict[str, Any]] = []
    citations: list[Citation] = []
    alerts_generated: list[str] = []
    confidence_score: float = 0.0
    ai_mode: str = "gemini"
    follow_up_suggestions: list[str] = []
    agent_steps: list[str] = []
    context_snapshot: Optional[dict[str, Any]] = None
    intent: str = "general"
    navigation_links: list[dict[str, str]] = []
    response_source: str = "unknown"


class FeedbackCreate(BaseModel):
    conversation_id: Optional[int] = None
    equipment_id: Optional[int] = None
    feedback_type: str
    original_recommendation: Optional[str] = None
    correction: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    outcome: Optional[str] = None


class ReportRequest(BaseModel):
    report_type: str = "maintenance_summary"
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None


class ReportSummaryStats(BaseModel):
    total_reports: int = 0
    last_24_hours: int = 0
    last_7_days: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)
    by_equipment: dict[str, int] = Field(default_factory=dict)
    latest_at: Optional[datetime] = None


class ReportListItem(BaseModel):
    id: int
    title: str
    report_type: str
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    generated_by: Optional[str] = None
    created_at: datetime
    risk_level: Optional[str] = None
    summary_preview: Optional[str] = None


class DiagnosisExportRequest(BaseModel):
    equipment_code: str
    equipment_name: Optional[str] = None
    answer: str = ""
    probable_causes: list[dict[str, Any]] = Field(default_factory=list)
    maintenance_actions: list[dict[str, Any]] = Field(default_factory=list)
    spare_recommendations: list[dict[str, Any]] = Field(default_factory=list)
    risk_level: str = "medium"
    failure_probability: Optional[float] = None
    rul_cycles: Optional[int] = None
    confidence_score: Optional[float] = None


class SensorIngestRequest(BaseModel):
    equipment_id: int
    temperature: Optional[float] = None
    vibration: Optional[float] = None
    pressure: Optional[float] = None
    motor_current: Optional[float] = None
    cycle: Optional[int] = None
    readings: Optional[list[dict[str, Any]]] = None


class DiagnosisRequest(BaseModel):
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    query: str
    sensor_data: Optional[dict[str, Any]] = None
    fault_description: Optional[str] = None
    include_rul: bool = True
    include_spare_parts: bool = True


class DiagnosisFeedbackCreate(BaseModel):
    equipment_id: Optional[int] = None
    diagnosis_summary: str = Field(min_length=10, max_length=4000)
    score: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)


class DiagnosisResponse(BaseModel):
    equipment_code: Optional[str] = None
    diagnosis: str
    probable_causes: list[dict[str, Any]] = []
    maintenance_actions: list[dict[str, Any]] = []
    risk_level: Optional[str] = None
    failure_probability: Optional[float] = None
    rul_cycles: Optional[int] = None
    process_defects: list[dict[str, Any]] = []
    spare_recommendations: list[dict[str, Any]] = []
    citations: list[dict[str, Any]] = []
    fault_description: Optional[str] = None
    explainability: dict[str, Any] = {}


class SensorHistoryPoint(BaseModel):
    timestamp: datetime
    cycle: Optional[int] = None
    temperature: Optional[float] = None
    vibration: Optional[float] = None
    pressure: Optional[float] = None
    motor_current: Optional[float] = None
    health_indicator: Optional[float] = None
    data_source: Optional[str] = None


class PredictionResponse(BaseModel):
    equipment_id: int
    failure_probability: float
    rul_cycles: int
    degradation_score: float
    risk_level: str
    anomaly_detected: bool
    contributing_factors: list[str]


class SparePartResponse(BaseModel):
    id: int
    part_code: str
    name: str
    equipment_type: Optional[str] = None
    quantity_available: int
    minimum_stock: int
    unit_cost: Optional[float] = None
    supplier: Optional[str] = None
    lead_time_days: int

    model_config = {"from_attributes": True}


class SparePartUpdate(BaseModel):
    quantity_available: Optional[int] = None
    minimum_stock: Optional[int] = None


class SparePartCreate(BaseModel):
    part_code: str = Field(min_length=2, max_length=100)
    name: str = Field(min_length=2, max_length=255)
    equipment_type: Optional[str] = None
    quantity_available: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=1, ge=1)
    unit_cost: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = None
    lead_time_days: int = Field(default=7, ge=1)


class SparePartRequestCreate(BaseModel):
    """Request a brand-new spare part (adds to catalog + creates procurement)."""
    part_code: str = Field(min_length=2, max_length=100)
    name: str = Field(min_length=2, max_length=255)
    equipment_type: Optional[str] = None
    quantity_requested: int = Field(ge=1)
    minimum_stock: int = Field(default=1, ge=1)
    unit_cost: Optional[float] = Field(default=None, ge=0)
    supplier: Optional[str] = None
    lead_time_days: int = Field(default=7, ge=1)
    urgency: str = "medium"
    equipment_id: Optional[int] = None
    notes: Optional[str] = None


class ProcurementCreate(BaseModel):
    spare_part_id: int
    equipment_id: Optional[int] = None
    quantity_requested: int = Field(ge=1)
    urgency: str = "medium"
    notes: Optional[str] = None


class ProcurementResponse(BaseModel):
    id: int
    spare_part_id: Optional[int] = None
    equipment_id: Optional[int] = None
    quantity_requested: int
    urgency: str
    status: str
    notes: Optional[str] = None
    created_at: datetime
    part_code: Optional[str] = None
    part_name: Optional[str] = None
    unit_cost: Optional[float] = None
    lead_time_days: Optional[int] = None
    equipment_type: Optional[str] = None
    estimated_cost: Optional[float] = None

    model_config = {"from_attributes": True}


class ProcurementReject(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class LogbookCreate(BaseModel):
    equipment_code: str
    description: str = Field(min_length=10, max_length=2000)
    maintenance_type: str = "ai_assisted_diagnosis"
    parts_used: Optional[str] = None
    performed_by: Optional[str] = "Maintenance Wizard"
    duration_hours: Optional[float] = Field(default=None, ge=0, le=72)
    cost: Optional[float] = Field(default=None, ge=0)
    outcome: Optional[str] = None


class LogbookEntry(BaseModel):
    id: int
    equipment_id: int
    equipment_code: Optional[str] = None
    equipment_name: Optional[str] = None
    maintenance_type: str
    performed_at: datetime
    performed_by: Optional[str] = None
    description: str
    parts_used: Optional[str] = None
    duration_hours: Optional[float] = None
    cost: Optional[float] = None
    outcome: Optional[str] = None

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    id: int
    title: Optional[str] = None
    equipment_id: Optional[int] = None
    created_at: datetime
    message_count: int = 0


class ConversationMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
