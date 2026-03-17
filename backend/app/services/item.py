"""Item service layer.

Contains business logic for item CRUD operations, keeping routes thin
and logic testable. Services receive a database session via dependency
injection.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.logging_config import get_logger
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate

logger = get_logger(__name__)


class ItemService:
    """Service for item CRUD operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_items(self, skip: int = 0, limit: int = 20) -> list[Item]:
        """List items with pagination."""
        stmt = select(Item).order_by(Item.created_at.desc()).offset(skip).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def count_items(self) -> int:
        """Return total count of items."""
        stmt = select(func.count()).select_from(Item)
        result = self.db.execute(stmt).scalar()
        return result or 0

    def get_item(self, item_id: uuid.UUID) -> Item | None:
        """Get a single item by ID."""
        stmt = select(Item).where(Item.id == item_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_item(self, data: ItemCreate) -> Item:
        """Create a new item."""
        item = Item(
            name=data.name,
            description=data.description,
            is_active=data.is_active,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_item(self, item_id: uuid.UUID, data: ItemUpdate) -> Item | None:
        """Update an existing item. Only updates fields that are set."""
        item = self.get_item(item_id)
        if item is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        self.db.commit()
        self.db.refresh(item)
        logger.info("item_service_updated", item_id=str(item_id), fields=list(update_data.keys()))
        return item

    def delete_item(self, item_id: uuid.UUID) -> bool:
        """Delete an item by ID. Returns True if deleted, False if not found."""
        item = self.get_item(item_id)
        if item is None:
            return False

        self.db.delete(item)
        self.db.commit()
        logger.info("item_service_deleted", item_id=str(item_id))
        return True
