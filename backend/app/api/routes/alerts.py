from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_user_role_name
from app.db.database import get_db
from app.models.entities import User
from app.models.schemas import ALERT_RESOLUTION_TYPES, AlertResolveRequest, AlertResponse
from app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])
alert_service = AlertService()


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    db: Annotated[AsyncSession, Depends(get_db)],
    unacknowledged_only: bool = False,
    unresolved_only: bool = Query(default=False, description="Exclude resolved alerts"),
    limit: int = 50,
    role_filter: bool = Query(default=False, description="Filter alerts by user role when authenticated"),
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    role_name = None
    if role_filter and user:
        role_name = await get_user_role_name(db, user)
    alerts = await alert_service.list_alerts(
        db,
        limit=limit,
        unacknowledged_only=unacknowledged_only,
        unresolved_only=unresolved_only,
        role_name=role_name,
    )
    return alerts


@router.get("/resolution-types")
async def list_resolution_types():
    return {"types": list(ALERT_RESOLUTION_TYPES)}


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    alert = await alert_service.acknowledge(db, alert_id, user.id if user else None)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    body: AlertResolveRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[Optional[User], Depends(get_current_user)] = None,
):
    try:
        alert = await alert_service.resolve(
            db,
            alert_id,
            resolution_type=body.resolution_type,
            resolution_notes=body.resolution_notes,
            user_id=user.id if user else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
