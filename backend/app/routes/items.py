"""Example CRUD resource demonstrating ClawStack patterns.

This module shows the recommended patterns for building API endpoints:
- Pydantic schemas for request/response validation
- Async service layer for business logic (non-blocking DB + LLM calls)
- Dependency injection for database sessions
- Structured logging for observability
- Proper HTTP status codes and error handling
- Domain exception translation (services never raise HTTPException)
- Route-level transaction control (routes commit, services only flush)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger
from app.models.base import get_db
from app.schemas.item import ItemCreate, ItemListResponse, ItemResponse, ItemUpdate
from app.services.item import ItemService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/items", tags=["items"])


async def get_item_service(db: AsyncSession = Depends(get_db)) -> ItemService:
    """Dependency that provides an ItemService instance."""
    return ItemService(db)


@router.get(
    "",
    response_model=ItemListResponse,
    summary="List items",
)
async def list_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max items to return"),
    service: ItemService = Depends(get_item_service),
) -> ItemListResponse:
    """List items with pagination."""
    items = await service.list_items(skip=skip, limit=limit)
    total = await service.count_items()
    logger.info("items_listed", count=len(items), skip=skip, limit=limit, total=total)
    return ItemListResponse(
        items=[ItemResponse.model_validate(item) for item in items],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create item",
)
async def create_item(
    payload: ItemCreate,
    db: AsyncSession = Depends(get_db),
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Create a new item."""
    item = await service.create_item(payload)
    await db.commit()
    logger.info("item_created", item_id=str(item.id), name=item.name)
    return ItemResponse.model_validate(item)


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    summary="Get item",
)
async def get_item(
    item_id: uuid.UUID,
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Get an item by ID."""
    item = await service.get_item(item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    return ItemResponse.model_validate(item)


@router.put(
    "/{item_id}",
    response_model=ItemResponse,
    summary="Update item",
)
async def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Update an existing item."""
    item = await service.update_item(item_id, payload)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    await db.commit()
    logger.info("item_updated", item_id=str(item_id))
    return ItemResponse.model_validate(item)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete item",
)
async def delete_item(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: ItemService = Depends(get_item_service),
) -> None:
    """Delete an item by ID."""
    deleted = await service.delete_item(item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    await db.commit()
    logger.info("item_deleted", item_id=str(item_id))
