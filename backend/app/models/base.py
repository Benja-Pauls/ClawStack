"""SQLAlchemy base model and async database engine configuration.

Provides the declarative base with common fields (id, created_at, updated_at)
and the async database session factory.

The engine and session factory are lazily initialized to avoid triggering
database connections at import time (which would fail during linting,
IDE indexing, or when Postgres isn't running).
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator
from datetime import datetime
from functools import lru_cache

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
)

from app.config import settings


@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    """Create and cache the async database engine.

    Lazily initialized on first call to avoid connection attempts
    at module import time.
    """
    return create_async_engine(
        settings.DATABASE_URL,
        pool_size=settings.db.pool_size,
        max_overflow=settings.db.max_overflow,
        pool_timeout=settings.db.pool_timeout,
        pool_recycle=settings.db.pool_recycle,
        echo=settings.db.echo,
    )


@lru_cache(maxsize=1)
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create and cache the async session factory bound to the engine.

    expire_on_commit=False is required for async SQLAlchemy: after commit(),
    accessing object attributes (e.g. user.id) would otherwise trigger implicit
    lazy loads that fail with MissingGreenlet. See SQLAlchemy asyncio docs.
    """
    return async_sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=get_engine(),
        expire_on_commit=False,
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides an async database session.

    Yields a session and ensures it is closed after the request.
    If an exception occurs after flush() but before commit(),
    the session is explicitly rolled back to prevent ambiguous state.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    session_factory = get_session_factory()
    async with session_factory() as db:
        try:
            yield db
        except Exception:
            await db.rollback()
            raise


class Base(DeclarativeBase):
    """Declarative base class with common fields.

    All models should inherit from this class to get:
    - id: UUID primary key (auto-generated)
    - created_at: timestamp set on insert
    - updated_at: timestamp set on insert and updated on every change
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
