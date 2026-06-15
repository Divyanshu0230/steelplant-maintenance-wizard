from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[Optional[int]] = mapped_column(ForeignKey("roles.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    role: Mapped[Optional["Role"]] = relationship()


class Equipment(Base):
    __tablename__ = "equipment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_code: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    equipment_type: Mapped[str] = mapped_column(String(100))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    criticality: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(50), default="operational")
    installation_date: Mapped[Optional[date]] = mapped_column(Date)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(255))
    model: Mapped[Optional[str]] = mapped_column(String(255))
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SensorData(Base):
    __tablename__ = "sensor_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    temperature: Mapped[Optional[float]] = mapped_column(Float)
    vibration: Mapped[Optional[float]] = mapped_column(Float)
    pressure: Mapped[Optional[float]] = mapped_column(Float)
    motor_current: Mapped[Optional[float]] = mapped_column(Float)
    operational_setting_1: Mapped[Optional[float]] = mapped_column(Float)
    operational_setting_2: Mapped[Optional[float]] = mapped_column(Float)
    operational_setting_3: Mapped[Optional[float]] = mapped_column(Float)
    cycle: Mapped[Optional[int]] = mapped_column(Integer)
    health_indicator: Mapped[Optional[float]] = mapped_column(Float)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class FailureHistory(Base):
    __tablename__ = "failure_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    failure_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    failure_mode: Mapped[Optional[str]] = mapped_column(String(255))
    root_cause: Mapped[Optional[str]] = mapped_column(Text)
    downtime_hours: Mapped[Optional[float]] = mapped_column(Float)
    repair_action: Mapped[Optional[str]] = mapped_column(Text)
    severity: Mapped[Optional[str]] = mapped_column(String(20))


class EquipmentDelayLog(Base):
    __tablename__ = "equipment_delay_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    delay_hours: Mapped[float] = mapped_column(Float)
    production_loss_tonnes: Mapped[Optional[float]] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class FaultMessage(Base):
    __tablename__ = "fault_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    fault_code: Mapped[str] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(50), default="SCADA")
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    maintenance_type: Mapped[str] = mapped_column(String(50))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    performed_by: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    parts_used: Mapped[Optional[str]] = mapped_column(Text)
    duration_hours: Mapped[Optional[float]] = mapped_column(Float)
    cost: Mapped[Optional[float]] = mapped_column(Float)
    outcome: Mapped[Optional[str]] = mapped_column(String(50))


class SparePart(Base):
    __tablename__ = "spare_parts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    part_code: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    equipment_type: Mapped[Optional[str]] = mapped_column(String(100))
    quantity_available: Mapped[int] = mapped_column(Integer, default=0)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=1)
    unit_cost: Mapped[Optional[float]] = mapped_column(Float)
    supplier: Mapped[Optional[str]] = mapped_column(String(255))
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    document_type: Mapped[str] = mapped_column(String(50))
    equipment_type: Mapped[Optional[str]] = mapped_column(String(100))
    file_path: Mapped[Optional[str]] = mapped_column(String(1000))
    content_hash: Mapped[Optional[str]] = mapped_column(String(64))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    prediction_type: Mapped[str] = mapped_column(String(50))
    failure_probability: Mapped[Optional[float]] = mapped_column(Float)
    rul_cycles: Mapped[Optional[int]] = mapped_column(Integer)
    degradation_score: Mapped[Optional[float]] = mapped_column(Float)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    model_version: Mapped[Optional[str]] = mapped_column(String(50))
    features: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EquipmentHealthScore(Base):
    __tablename__ = "equipment_health_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    health_score: Mapped[float] = mapped_column(Float)
    anomaly_score: Mapped[Optional[float]] = mapped_column(Float)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20))
    factors: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[int] = mapped_column(ForeignKey("equipment.id"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    anomaly_type: Mapped[Optional[str]] = mapped_column(String(100))
    severity: Mapped[Optional[str]] = mapped_column(String(20))
    sensor_name: Mapped[Optional[str]] = mapped_column(String(100))
    observed_value: Mapped[Optional[float]] = mapped_column(Float)
    expected_range: Mapped[Optional[str]] = mapped_column(String(100))
    detection_method: Mapped[Optional[str]] = mapped_column(String(50))
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment.id"))
    alert_level: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(500))
    message: Mapped[str] = mapped_column(Text)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    is_acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    resolution_type: Mapped[Optional[str]] = mapped_column(String(80))
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment.id"))
    title: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"))
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    conversation_id: Mapped[Optional[int]] = mapped_column(ForeignKey("conversations.id"))
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment.id"))
    feedback_type: Mapped[str] = mapped_column(String(50))
    original_recommendation: Mapped[Optional[str]] = mapped_column(Text)
    correction: Mapped[Optional[str]] = mapped_column(Text)
    rating: Mapped[Optional[int]] = mapped_column(Integer)
    outcome: Mapped[Optional[str]] = mapped_column(String(100))
    metadata_: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    report_type: Mapped[str] = mapped_column(String(50))
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment.id"))
    title: Mapped[str] = mapped_column(String(500))
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    generated_by: Mapped[Optional[str]] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProcurementRequest(Base):
    __tablename__ = "procurement_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    spare_part_id: Mapped[Optional[int]] = mapped_column(ForeignKey("spare_parts.id"))
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipment.id"))
    quantity_requested: Mapped[int] = mapped_column(Integer)
    urgency: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(50), default="pending")
    requested_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100))
    resource_type: Mapped[Optional[str]] = mapped_column(String(100))
    resource_id: Mapped[Optional[int]] = mapped_column(Integer)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
