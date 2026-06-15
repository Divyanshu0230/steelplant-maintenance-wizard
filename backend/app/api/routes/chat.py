import asyncio
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.fast_pipeline import get_fast_pipeline
from app.agents.orchestrator import get_orchestrator
from app.agents.response_builder import agent_state_to_response
from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entities import Conversation, ConversationMessage, Equipment, User
from app.models.schemas import ChatRequest, ChatResponse, Citation, MaintenanceAction
from app.services.alert_service import AlertService
from app.services.app_assistant import run_app_assistant
from app.services.intent_router import classify_intent
from app.core.config import get_settings
from app.services.report_service import ReportService
from app.utils.answer_format import (
    build_agent_steps,
    build_fast_pipeline_steps,
    extract_follow_ups,
    format_structured_answer,
)

router = APIRouter(prefix="/chat", tags=["chat"])
alert_service = AlertService()
report_service = ReportService()

CHAT_TIMEOUT_SECONDS = 180


async def _load_history(db: AsyncSession, conversation_id: int) -> list[dict[str, str]]:
    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
        .limit(20)
    )
    return [{"role": m.role, "content": m.content} for m in result.scalars().all()]


async def _default_equipment_code(db: AsyncSession) -> str:
    result = await db.execute(select(Equipment).order_by(Equipment.id).limit(1))
    eq = result.scalar_one_or_none()
    return eq.equipment_code if eq else "RM-MOTOR-03"


def _response_source(ai_mode: str, *, full_agents: bool = False) -> str:
    if ai_mode == "enhanced_offline":
        return "ml_rag_engine"
    if full_agents or ai_mode in (
        "groq",
        "anthropic",
        "openai",
        "xai",
        "gemini",
        "ollama",
        "agentic",
    ):
        return "full_agentic_orchestrator" if full_agents else "agentic_ai"
    return "ml_rag_engine"


def _assistant_response(
    *,
    conversation_id: int,
    result: dict,
    follow_ups: Optional[list[str]] = None,
) -> ChatResponse:
    ai_mode = result.get("ai_mode", "gemini")
    return ChatResponse(
        conversation_id=conversation_id,
        answer=result["answer"],
        risk_level=result.get("risk_level", "low"),
        confidence_score=result.get("confidence_score", 0.9),
        ai_mode=ai_mode,
        agent_steps=result.get("agent_steps", []),
        intent=result.get("intent", "general"),
        navigation_links=result.get("navigation_links", []),
        follow_up_suggestions=follow_ups or [],
        response_source=result.get("response_source", "navigation_guide"),
    )


async def _run_maintenance_pipeline(
    db: AsyncSession,
    *,
    message: str,
    equipment_code: Optional[str],
    equipment_id: Optional[int],
    history: list[dict[str, str]],
    use_full_agents: bool,
) -> dict:
    if use_full_agents:
        raw_state = await get_orchestrator().run(
            db,
            query=message,
            equipment_id=equipment_id,
            equipment_code=equipment_code,
            conversation_history=history,
        )
        state = agent_state_to_response(raw_state)
        state["agent_steps"] = build_agent_steps({**state, "ai_mode": state.get("ai_mode", "agentic")})
        state["response_source"] = _response_source(state.get("ai_mode", "agentic"), full_agents=True)
        return state

    state = await get_fast_pipeline().run(
        db,
        query=message,
        equipment_id=equipment_id,
        equipment_code=equipment_code,
        conversation_history=history,
    )
    state["agentic"] = True
    state["agent_steps"] = build_fast_pipeline_steps(state)
    state["response_source"] = _response_source(state.get("ai_mode", "gemini"))
    return state


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    conversation: Optional[Conversation] = None
    if payload.conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == payload.conversation_id)
        )
        conversation = result.scalar_one_or_none()

    if not conversation:
        conversation = Conversation(
            user_id=user.id if user else None,
            equipment_id=payload.equipment_id,
            title=payload.message[:80],
        )
        db.add(conversation)
        await db.flush()

    history = await _load_history(db, conversation.id)

    db.add(
        ConversationMessage(
            conversation_id=conversation.id,
            role="user",
            content=payload.message,
        )
    )
    await db.flush()

    intent = classify_intent(
        payload.message,
        chat_mode=payload.chat_mode,
        equipment_code=payload.equipment_code,
        conversation_history=history,
    )

    equipment_code = payload.equipment_code
    if intent == "maintenance" and not equipment_code:
        equipment_code = await _default_equipment_code(db)

    try:
        if intent in ("greeting", "navigation", "general"):
            result = await asyncio.wait_for(
                run_app_assistant(
                    payload.message,
                    intent=intent,
                    current_page=payload.current_page,
                    equipment_code=equipment_code,
                    history=history,
                ),
                timeout=45,
            )
            result["response_source"] = result.get(
                "response_source",
                _response_source(result.get("ai_mode", "agentic")),
            )
            db.add(
                ConversationMessage(
                    conversation_id=conversation.id,
                    role="assistant",
                    content=result["answer"],
                    metadata_={
                        "intent": intent,
                        "ai_mode": result.get("ai_mode"),
                        "response_source": result["response_source"],
                    },
                )
            )
            await db.flush()

            follow_ups = []
            if intent == "navigation":
                follow_ups = [
                    "Is it safe to keep running?",
                    "Where is the equipment fleet?",
                    "What does the Priority Queue show?",
                ]
            elif intent == "general":
                follow_ups = [
                    "Where is Live Monitoring?",
                    "What is causing high vibration?",
                    "Is it safe to keep running?",
                ]

            return _assistant_response(
                conversation_id=conversation.id,
                result=result,
                follow_ups=follow_ups,
            )

        settings = get_settings()
        use_full = payload.use_full_agents or settings.enable_full_agentic

        state = await asyncio.wait_for(
            _run_maintenance_pipeline(
                db,
                message=payload.message,
                equipment_code=equipment_code,
                equipment_id=payload.equipment_id,
                history=history,
                use_full_agents=use_full,
            ),
            timeout=CHAT_TIMEOUT_SECONDS,
        )
        ai_mode = state.get("ai_mode", "agentic")

    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Request timed out. Please try again in a few seconds.",
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"AI error: {exc}") from exc

    alerts = await alert_service.create_from_agent_alerts(
        db, state.get("equipment_id"), state.get("alerts", [])
    )

    if state.get("equipment_id") and len(state.get("final_answer", "")) > 50:
        await report_service.create_logbook_entry(
            db,
            equipment_id=state["equipment_id"],
            description=state.get("final_answer", "")[:500],
            maintenance_type="ai_assisted_diagnosis",
            performed_by=user.full_name if user else "Maintenance Wizard",
        )

    db.add(
        ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=state.get("final_answer", ""),
            metadata_={
                "probable_causes": state.get("probable_causes", []),
                "risk_level": state.get("risk_level"),
                "citations": state.get("citations", []),
                "ai_mode": ai_mode,
                "intent": "maintenance",
                "response_source": state.get("response_source"),
            },
        )
    )
    await db.flush()

    raw_confidence = state.get("confidence_score", 0.0)
    if isinstance(raw_confidence, str):
        conf_map = {"low": 0.3, "medium": 0.5, "high": 0.85, "critical": 0.95}
        confidence_score = conf_map.get(raw_confidence.lower().replace(" ", "-"), 0.5)
    else:
        confidence_score = float(raw_confidence or 0.0)

    safe_actions: list[MaintenanceAction] = []
    for action in state.get("maintenance_actions", []):
        if not action.get("action"):
            continue
        try:
            safe_actions.append(
                MaintenanceAction(
                    priority=str(action.get("priority", "medium")),
                    action=str(action["action"]),
                    timeframe=str(action.get("timeframe", "As per SOP")),
                    rationale=str(action.get("rationale", "")),
                )
            )
        except Exception:
            continue

    safe_citations: list[Citation] = []
    for c in state.get("citations", []):
        try:
            safe_citations.append(
                Citation(
                    source=str(c.get("source", "unknown")),
                    document_type=str(c.get("document_type", "document")),
                    excerpt=str(c.get("excerpt", ""))[:500],
                    relevance_score=float(c.get("relevance_score", 0)),
                )
            )
        except Exception:
            continue

    final_answer = format_structured_answer(
        query=payload.message,
        equipment_code=state.get("equipment_code") or equipment_code,
        answer=state.get("final_answer", ""),
        causes=state.get("probable_causes", []),
        actions=state.get("maintenance_actions", []),
        risk_level=state.get("risk_level", "medium"),
        failure_probability=state.get("failure_probability"),
        rul_cycles=state.get("rul_cycles"),
        ai_mode=ai_mode,
        spare_recommendations=state.get("spare_recommendations", []),
        citations=state.get("citations", []),
    )
    agent_steps = state.get("agent_steps") or build_fast_pipeline_steps(state)
    follow_ups = extract_follow_ups(final_answer)
    if not follow_ups:
        follow_ups = [
            "What should I do next?",
            "Is it safe to keep running?",
            "Which spare parts do I need?",
        ]

    use_full = payload.use_full_agents or settings.enable_full_agentic
    response_source = state.get("response_source") or _response_source(ai_mode, full_agents=use_full)
    if use_full:
        response_source = "full_agentic_orchestrator"
    display_mode = ai_mode if ai_mode not in ("enhanced_offline", "offline", "unknown") else "agentic"

    ctx = {
        "equipment_code": state.get("equipment_code") or equipment_code,
        "equipment_name": state.get("equipment_name"),
        "location": state.get("equipment_location"),
        "criticality": state.get("equipment_criticality"),
        "sensor_readings": state.get("sensor_readings", {}),
        "data_source": state.get("data_source", "plant_sensors"),
        "anomaly_detected": state.get("anomaly_detected", False),
        "ai_engine": display_mode,
        "using_full_llm": display_mode in ("gemini", "groq", "anthropic", "openai", "xai", "ollama", "agentic"),
        "agentic": state.get("agentic", True),
        "agent_trace": state.get("agent_trace", []),
        "response_source": response_source,
    }

    return ChatResponse(
        conversation_id=conversation.id,
        answer=final_answer,
        probable_causes=state.get("probable_causes", []),
        risk_level=state.get("risk_level", "medium"),
        failure_probability=state.get("failure_probability"),
        rul_cycles=state.get("rul_cycles"),
        maintenance_actions=safe_actions,
        spare_recommendations=state.get("spare_recommendations", []),
        citations=safe_citations,
        alerts_generated=[a.title for a in alerts],
        confidence_score=confidence_score,
        ai_mode=display_mode,
        follow_up_suggestions=follow_ups,
        agent_steps=agent_steps,
        context_snapshot=ctx,
        intent="maintenance",
        response_source=response_source,
    )
