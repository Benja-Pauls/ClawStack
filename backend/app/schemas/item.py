"""Item request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ItemCreate(BaseModel):
    """Schema for creating a new item."""

    name: str = Field(min_length=1, max_length=255, description="Item name")
    description: str | None = Field(default=None, description="Item description")
    is_active: bool = Field(default=True, description="Whether the item is active")


class ItemUpdate(BaseModel):
    """Schema for updating an item. All fields are optional."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_active: bool | None = None


class ItemResponse(BaseModel):
    """Schema for item responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ItemListResponse(BaseModel):
    """Paginated list of items."""

    items: list[ItemResponse]
    total: int
    skip: int
    limit: int
