"""Item SQLAlchemy model."""

from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Item(Base):
    """Example item model demonstrating ClawStack patterns.

    This serves as a reference for creating new models. Each model should:
    - Inherit from Base (gets id, created_at, updated_at automatically)
    - Define __tablename__
    - Use Mapped[] type annotations for all columns
    """

    __tablename__ = "items"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, name={self.name!r})>"
