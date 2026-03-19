"""User SQLAlchemy model."""

from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    """User model for local JWT authentication.

    Stores hashed passwords using bcrypt via passlib. This model
    supports the built-in custom JWT auth provider. When swapping
    to an external provider (Clerk, Auth0), this model can be
    replaced or extended — see .skills/auth/SKILL.md.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email!r})>"
