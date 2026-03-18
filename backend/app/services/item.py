"""Item service layer.

Contains business logic for item CRUD operations, keeping routes thin
and logic testable. Services receive an async database session via dependency
injection and raise domain exceptions (not HTTPException).

Services flush but do NOT commit — the route layer owns the transaction
boundary. This allows multiple service calls to be composed in a single
transaction (e.g., "create project + add owner as member" atomically).
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate

logger = get_logger(__name__)


class ItemService:
    """Service for item CRUD operations.

    Services return None or raise domain-specific exceptions — never
    HTTPException. The route layer is responsible for translating
    service results into HTTP responses and committing the transaction.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_items(self, skip: int = 0, limit: int = 20) -> list[Item]:
        """List items with pagination."""
        stmt = select(Item).order_by(Item.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_items(self) -> int:
        """Return total count of items."""
        stmt = select(func.count()).select_from(Item)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_item(self, item_id: uuid.UUID) -> Item | None:
        """Get a single item by ID. Returns None if not found."""
        stmt = select(Item).where(Item.id == item_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_item(self, data: ItemCreate) -> Item:
        """Create a new item. Flushes to populate defaults but does not commit."""
        item = Item(
            name=data.name,
            description=data.description,
            is_active=data.is_active,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        return item

    async def update_item(self, item_id: uuid.UUID, data: ItemUpdate) -> Item | None:
        """Update an existing item. Returns None if not found."""
        item = await self.get_item(item_id)
        if item is None:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        await self.db.flush()
        await self.db.refresh(item)
        logger.info("item_service_updated", item_id=str(item_id), fields=list(update_data.keys()))
        return item

    async def delete_item(self, item_id: uuid.UUID) -> bool:
        """Delete an item by ID. Returns True if deleted, False if not found."""
        item = await self.get_item(item_id)
        if item is None:
            return False

        await self.db.delete(item)
        await self.db.flush()
        logger.info("item_service_deleted", item_id=str(item_id))
        return True
