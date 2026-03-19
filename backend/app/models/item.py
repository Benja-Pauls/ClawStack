"""Item SQLAlchemy model."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Item(Base):
    """Example item model demonstrating SerpentStack patterns.

    This serves as a reference for creating new models. Each model should:
    - Inherit from Base (gets id, created_at, updated_at automatically)
    - Define __tablename__
    - Use Mapped[] type annotations for all columns
    - Include user_id FK for user-scoped data (most resources need this)
    """

    __tablename__ = "items"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Owner — nullable so existing items (created before auth) still work.
    # New items created via authenticated routes will always have a user_id.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, name={self.name!r})>"
