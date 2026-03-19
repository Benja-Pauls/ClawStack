"""Authentication routes and dependencies.

Provides local JWT authentication with bcrypt password hashing.
Register, login, and get-current-user endpoints work out of the box
with no external services.

To swap to an external provider (Clerk, Auth0, etc.), see the auth
skill at .skills/auth/SKILL.md which explains how to replace
get_current_user while keeping the rest of the codebase unchanged.
"""

from __future__ import annotations

import uuid
from typing import Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.config import settings
from app.logging_config import get_logger
from app.models.base import get_db
from app.rate_limit import limiter
from app.schemas.user import TokenResponse, UserLogin, UserRegister, UserResponse
from app.services.user import UserService, create_access_token

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Bearer token security scheme
bearer_scheme = HTTPBearer(auto_error=False)


class UserInfo(BaseModel):
    """Authenticated user context injected into protected routes.

    This is the interface between auth and the rest of the app.
    When swapping auth providers, keep this shape — routes depend on it.
    """

    user_id: str
    email: str | None = None
    name: str | None = None
    raw_claims: dict[str, Any] = {}


# ── Dependencies ──────────────────────────────────────────────


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserInfo:
    """Extract and validate the current user from the Authorization header.

    Usage in routes:
        @router.get("/protected")
        async def protected_route(user: UserInfo = Depends(get_current_user)):
            return {"user_id": user.user_id}
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        ) from exc
    except jwt.InvalidTokenError as exc:
        logger.warning("jwt_decode_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    return UserInfo(
        user_id=user_id,
        email=payload.get("email"),
        name=payload.get("name"),
        raw_claims=payload,
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserInfo | None:
    """Like get_current_user but returns None instead of raising 401."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def _get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(db)


# ── Routes ────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
    service: UserService = Depends(_get_user_service),
) -> TokenResponse:
    """Create a new user account and return a JWT token."""
    user = await service.register(payload)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )
    await db.commit()

    token = create_access_token(str(user.id), user.email)
    logger.info("user_registered", user_id=str(user.id))
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
)
@limiter.limit("10/minute")
async def login(
    request: Request,
    payload: UserLogin,
    service: UserService = Depends(_get_user_service),
) -> TokenResponse:
    """Authenticate with email/password and receive a JWT token."""
    user = await service.authenticate(payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id), user.email)
    logger.info("user_logged_in", user_id=str(user.id))
    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user",
)
async def get_me(
    current_user: UserInfo = Depends(get_current_user),
    service: UserService = Depends(_get_user_service),
) -> UserResponse:
    """Return the authenticated user's profile.

    Requires a valid Bearer token in the Authorization header.
    """
    user = await service.get_by_id(uuid.UUID(current_user.user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserResponse.model_validate(user)
