"""SQLAlchemy base model and database engine configuration.

Provides the declarative base with common fields (id, created_at, updated_at)
and the database session factory.

The engine and session factory are lazily initialized to avoid triggering
database connections at import time (which would fail during linting,
IDE indexing, or when Postgres isn't running).
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import datetime
from functools import lru_cache

from sqlalchemy import DateTime, Engine, create_engine, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    sessionmaker,
)

from app.config import settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Create and cache the database engine.

    Lazily initialized on first call to avoid connection attempts
    at module import time.
    """
    return create_engine(
        settings.DATABASE_URL,
        pool_size=settings.db.pool_size,
        max_overflow=settings.db.max_overflow,
        pool_timeout=settings.db.pool_timeout,
        pool_recycle=settings.db.pool_recycle,
        echo=settings.db.echo,
    )


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the session factory bound to the engine."""
    return sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session.

    Yields a session and ensures it is closed after the request.

    Usage:
        @router.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...
    """
    session_factory = get_session_factory()
    db = session_factory()
    try:
        yield db
    finally:
        db.close()


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
