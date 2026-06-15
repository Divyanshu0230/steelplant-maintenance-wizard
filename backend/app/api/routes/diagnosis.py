"""Structured diagnosis endpoint — TATA hackathon compatible."""

from typing import Annotated, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.fast_pipeline import get_fast_pipeline
from app.agents.orchestrator import get_orchestrator
from app.agents.response_builder import agent_state_to_response
from app.core.config import get_settings
from app.db.database import get_db
from app.models.entities import Equipment, Feedback
from app.models.schemas import DiagnosisFeedbackCreate, DiagnosisRequest, DiagnosisResponse
from app.utils.answer_format import build_agent_steps, build_fast_pipeline_steps

router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])


def _normalize_sensor_data(data: Optional[dict[str, Any]]) -> dict[str, float]:
    if not data:
        return {}
    mapping = {
        "vibration_mm_s": "vibration",
        "vibration": "vibration",
        "temperature_c": "temperature",
        "temperature": "temperature",
        "current_a": "motor_current",
        "motor_current": "motor_current",
        "pressure_bar": "pressure",
        "oil_pressure_bar": "pressure",
        "pressure": "pressure",
    }
    out: dict[str, float] = {}
    for k, v in data.items():
        key = mapping.get(k, k)
        if key in ("vibration", "temperature", "motor_current", "pressure") and v is not None:
            out[key] = float(v)
    return out


@router.post("", response_model=DiagnosisResponse)
async def diagnose(
    payload: DiagnosisRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Run full maintenance diagnosis (RCA + RUL + actions + spares)."""
    equipment = None
    if payload.equipment_id:
        r = await db.execute(select(Equipment).where(Equipment.id == payload.equipment_id))
        equipment = r.scalar_one_or_none()
    elif payload.equipment_code:
        r = await db.execute(
            select(Equipment).where(Equipment.equipment_code == payload.equipment_code)
        )
        equipment = r.scalar_one_or_none()
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    query = payload.query
    if payload.fault_description:
        query = f"{query}\n\nFault/alert context: {payload.fault_description}"

    settings = get_settings()
    if settings.enable_full_agentic:
        raw_state = await get_orchestrator().run(
            db,
            query=query,
            equipment_id=equipment.id,
            equipment_code=equipment.equipment_code,
        )
        state = agent_state_to_response(raw_state)
        agent_steps = build_agent_steps(state)
    else:
        state = await get_fast_pipeline().run(
            db,
            query=query,
            equipment_id=equipment.id,
            equipment_code=equipment.equipment_code,
        )
        agent_steps = build_fast_pipeline_steps(state)

    # Overlay request sensor_data when provided (explainability)
    sensor_overlay = _normalize_sensor_data(payload.sensor_data)
    readings = {**(state.get("sensor_readings") or {}), **sensor_overlay}

    causes = state.get("probable_causes") or []
    actions = state.get("maintenance_actions") or []
    spares = state.get("spare_recommendations") or [] if payload.include_spare_parts else []

    return DiagnosisResponse(
        equipment_code=equipment.equipment_code,
        diagnosis=state.get("final_answer") or "",
        probable_causes=causes,
        maintenance_actions=actions,
        risk_level=state.get("risk_level"),
        failure_probability=state.get("failure_probability") if payload.include_rul else None,
        rul_cycles=state.get("rul_cycles") if payload.include_rul else None,
        process_defects=state.get("process_defects") or [],
        spare_recommendations=spares,
        citations=state.get("citations") or [],
        fault_description=payload.fault_description,
        explainability={
            "sensor_readings": readings,
            "data_source": state.get("data_source"),
            "operational_context": state.get("operational_context"),
            "risk_factors": state.get("risk_factors"),
            "agent_steps": agent_steps,
            "ai_mode": state.get("ai_mode"),
        },
    )


@router.post("/feedback")
async def diagnosis_feedback(
    payload: DiagnosisFeedbackCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Star rating (1–5) on a diagnosis — TATA hackathon FR6 continuous improvement."""
    feedback = Feedback(
        equipment_id=payload.equipment_id,
        feedback_type="diagnosis_rating",
        original_recommendation=payload.diagnosis_summary[:2000],
        correction=payload.comment,
        rating=payload.score,
        outcome="helpful" if payload.score >= 4 else "needs_improvement",
    )
    db.add(feedback)
    await db.flush()
    from app.services.feedback_learning import get_feedback_learning

    learned = await get_feedback_learning().ingest_feedback(db, feedback)
    return {
        "status": "recorded",
        "message": "Diagnosis feedback recorded for continuous improvement.",
        "feedback_id": feedback.id,
        "learning": learned,
    }
