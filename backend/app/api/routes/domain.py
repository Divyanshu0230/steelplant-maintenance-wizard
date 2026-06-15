"""Domain model adaptation API — FR1 bonus merit."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.domain_adaptation_service import get_domain_adaptation_service

router = APIRouter(prefix="/domain", tags=["domain"])


@router.get("/profile")
async def domain_profile(db: Annotated[AsyncSession, Depends(get_db)]):
    """Steel domain adapter status — C-MAPSS + fault codes + feedback weights."""
    return await get_domain_adaptation_service().get_profile(db)


@router.post("/retrain")
async def retrain_domain_adapter(db: Annotated[AsyncSession, Depends(get_db)]):
    """Retrain domain profile from operational fault codes and engineer feedback."""
    return await get_domain_adaptation_service().retrain(db)
