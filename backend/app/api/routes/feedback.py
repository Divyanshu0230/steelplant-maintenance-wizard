from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entities import Feedback, User
from app.models.schemas import FeedbackCreate
from app.services.feedback_learning import get_feedback_learning

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("")
async def submit_feedback(
    payload: FeedbackCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    feedback = Feedback(
        user_id=user.id if user else None,
        conversation_id=payload.conversation_id,
        equipment_id=payload.equipment_id,
        feedback_type=payload.feedback_type,
        original_recommendation=payload.original_recommendation,
        correction=payload.correction,
        rating=payload.rating,
        outcome=payload.outcome,
    )
    db.add(feedback)
    await db.flush()
    learned = await get_feedback_learning().ingest_feedback(db, feedback)
    return {
        "id": feedback.id,
        "status": "recorded",
        "message": "Feedback applied to learning system",
        "learning": learned,
    }


@router.get("/insights")
async def get_feedback_insights(db: Annotated[AsyncSession, Depends(get_db)]):
    """Summary of engineer feedback used to improve future recommendations."""
    learning = get_feedback_learning()
    total = await db.scalar(select(func.count()).select_from(Feedback)) or 0
    helpful = await db.scalar(
        select(func.count()).select_from(Feedback).where(
            Feedback.feedback_type == "confirmation",
            Feedback.rating >= 4,
        )
    ) or 0
    corrections = await db.scalar(
        select(func.count()).select_from(Feedback).where(Feedback.feedback_type == "correction")
    ) or 0

    recent_learnings: list[dict] = []
    for key, data in learning._cache.items():
        for c in data.get("confirmed_causes", [])[-2:]:
            recent_learnings.append({"type": "Confirmed", "text": c, "equipment": key})
        for c in data.get("corrections", [])[-2:]:
            recent_learnings.append({"type": "Correction", "text": c.get("text", ""), "equipment": key})

    result = await db.execute(select(Feedback).order_by(desc(Feedback.created_at)).limit(5))
    for row in result.scalars().all():
        if row.correction or row.original_recommendation:
            recent_learnings.append({
                "type": row.feedback_type.title(),
                "text": (row.correction or row.original_recommendation or "")[:120],
                "equipment": f"equipment_{row.equipment_id}" if row.equipment_id else "global",
            })

    confirmed_count = sum(len(v.get("confirmed_causes", [])) for v in learning._cache.values())

    return {
        "total_feedback": total,
        "helpful_count": helpful,
        "correction_count": corrections,
        "confirmed_count": confirmed_count,
        "recent_learnings": recent_learnings[:8],
    }
