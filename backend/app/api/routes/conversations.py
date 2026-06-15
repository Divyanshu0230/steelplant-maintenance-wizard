from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.database import get_db
from app.models.entities import Conversation, ConversationMessage, User
from app.models.schemas import ConversationMessageResponse, ConversationSummary

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
    limit: int = 30,
):
    query = select(Conversation).order_by(desc(Conversation.created_at)).limit(limit)
    if user:
        query = query.where(
            (Conversation.user_id == user.id) | (Conversation.user_id.is_(None))
        )
    result = await db.execute(query)
    conversations = result.scalars().all()
    summaries = []
    for conv in conversations:
        count_result = await db.execute(
            select(func.count()).select_from(ConversationMessage)
            .where(ConversationMessage.conversation_id == conv.id)
        )
        summaries.append(ConversationSummary(
            id=conv.id,
            title=conv.title,
            equipment_id=conv.equipment_id,
            created_at=conv.created_at,
            message_count=count_result.scalar() or 0,
        ))
    return summaries


@router.get("/{conversation_id}/messages", response_model=list[ConversationMessageResponse])
async def get_conversation_messages(
    conversation_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    conv = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    if not conv.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")
    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
    )
    return result.scalars().all()
