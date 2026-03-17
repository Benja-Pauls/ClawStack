"""Example CRUD resource demonstrating ClawStack patterns.

This module shows the recommended patterns for building API endpoints:
- Pydantic schemas for request/response validation
- Service layer for business logic
- Dependency injection for database sessions
- Structured logging for observability
- Proper HTTP status codes and error handling

NOTE: Route handlers are defined as regular `def` (not `async def`) because
the service layer uses synchronous SQLAlchemy. FastAPI automatically runs
sync handlers in a threadpool, avoiding event loop blocking.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.logging_config import get_logger
from app.models.base import get_db
from app.schemas.item import ItemCreate, ItemListResponse, ItemResponse, ItemUpdate
from app.services.item import ItemService

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/items", tags=["items"])


def get_item_service(db: Session = Depends(get_db)) -> ItemService:
    """Dependency that provides an ItemService instance."""
    return ItemService(db)


@router.get(
    "",
    response_model=ItemListResponse,
    summary="List items",
)
def list_items(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max items to return"),
    service: ItemService = Depends(get_item_service),
) -> ItemListResponse:
    """List items with pagination."""
    items = service.list_items(skip=skip, limit=limit)
    total = service.count_items()
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
def create_item(
    payload: ItemCreate,
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Create a new item."""
    item = service.create_item(payload)
    logger.info("item_created", item_id=str(item.id), name=item.name)
    return ItemResponse.model_validate(item)


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    summary="Get item",
)
def get_item(
    item_id: uuid.UUID,
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Get an item by ID."""
    item = service.get_item(item_id)
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
def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    service: ItemService = Depends(get_item_service),
) -> ItemResponse:
    """Update an existing item."""
    item = service.update_item(item_id, payload)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    logger.info("item_updated", item_id=str(item_id))
    return ItemResponse.model_validate(item)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete item",
)
def delete_item(
    item_id: uuid.UUID,
    service: ItemService = Depends(get_item_service),
) -> None:
    """Delete an item by ID."""
    deleted = service.delete_item(item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        )
    logger.info("item_deleted", item_id=str(item_id))
