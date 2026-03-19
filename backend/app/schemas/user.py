"""User request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    """Schema for user registration."""

    email: EmailStr = Field(description="User email address")
    password: str = Field(min_length=8, max_length=128, description="Password (min 8 characters)")
    name: str | None = Field(default=None, max_length=255, description="Display name")


class UserLogin(BaseModel):
    """Schema for user login."""

    email: EmailStr = Field(description="User email address")
    password: str = Field(description="Password")


class UserResponse(BaseModel):
    """Schema for user responses (no password)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str | None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """Schema for JWT token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
