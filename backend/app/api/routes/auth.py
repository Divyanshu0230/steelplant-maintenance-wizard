from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.database import get_db
from app.models.entities import Role, User
from app.models.schemas import LoginRequest, LoginResponse, Token, UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(payload: UserCreate, db: Annotated[AsyncSession, Depends(get_db)]):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    role_result = await db.execute(select(Role).where(Role.name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role_id=role.id,
    )
    db.add(user)
    await db.flush()
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_name=role.name,
        is_active=user.is_active,
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    role_name = None
    if user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one_or_none()
        role_name = role.name if role else None
    token = create_access_token({"sub": str(user.id)})
    return LoginResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role_name=role_name,
            is_active=user.is_active,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[User, Depends(require_user)], db: Annotated[AsyncSession, Depends(get_db)]):
    role_name = None
    if user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one_or_none()
        role_name = role.name if role else None
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_name=role_name,
        is_active=user.is_active,
    )
