"""User service layer.

Handles user registration, authentication, and lookup.
Uses passlib for bcrypt password hashing.

Services flush but do NOT commit — the route layer owns the transaction boundary.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.logging_config import get_logger
from app.models.user import User
from app.schemas.user import UserRegister

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token expiry
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


class UserService:
    """Service for user operations.

    Returns None for not-found, raises no HTTPException.
    The route layer translates results to HTTP responses.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_email(self, email: str) -> User | None:
        """Look up a user by email."""
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Look up a user by ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def register(self, data: UserRegister) -> User | None:
        """Register a new user. Returns None if email already taken."""
        existing = await self.get_by_email(data.email)
        if existing is not None:
            return None

        user = User(
            email=data.email,
            hashed_password=_hash_password(data.password),
            name=data.name,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        logger.info("user_registered", user_id=str(user.id), email=user.email)
        return user

    async def authenticate(self, email: str, password: str) -> User | None:
        """Validate credentials. Returns user if valid, None otherwise."""
        user = await self.get_by_email(email)
        if user is None:
            return None
        if not _verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return user
