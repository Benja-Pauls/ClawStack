"""Tests for health check and item CRUD endpoints.

All tests use a real PostgreSQL instance via testcontainers and
async httpx.AsyncClient (not FastAPI's sync TestClient) so the
async SQLAlchemy engine works end-to-end.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """GET /api/v1/health returns healthy status."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"
    assert "environment" in data


@pytest.mark.asyncio
async def test_health_check_has_version(client: AsyncClient) -> None:
    """Health response includes a valid version string."""
    response = await client.get("/api/v1/health")
    data = response.json()
    parts = data["version"].split(".")
    assert len(parts) == 3, "Version should be semver format"


@pytest.mark.asyncio
async def test_readiness_check(client: AsyncClient) -> None:
    """GET /api/v1/health/ready checks database connectivity."""
    response = await client.get("/api/v1/health/ready")
    data = response.json()

    assert "status" in data
    assert "version" in data
    assert "environment" in data
    assert "details" in data


@pytest.mark.asyncio
async def test_health_response_schema(client: AsyncClient) -> None:
    """Verify health response matches the expected schema."""
    response = await client.get("/api/v1/health")
    data = response.json()

    required_fields = {"status", "version", "environment"}
    assert required_fields.issubset(set(data.keys()))


@pytest.mark.asyncio
async def test_items_crud_lifecycle(client: AsyncClient) -> None:
    """Test full CRUD lifecycle for items endpoint."""
    # Create
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Test Item", "description": "A test item"},
    )
    assert create_resp.status_code == 201
    item = create_resp.json()
    item_id = item["id"]
    assert item["name"] == "Test Item"
    assert item["is_active"] is True

    # Read
    get_resp = await client.get(f"/api/v1/items/{item_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Test Item"

    # Update
    update_resp = await client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "Updated Item"},
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Item"

    # List
    list_resp = await client.get("/api/v1/items")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1

    # Delete
    delete_resp = await client.delete(f"/api/v1/items/{item_id}")
    assert delete_resp.status_code == 204

    # Verify deleted
    get_resp = await client.get(f"/api/v1/items/{item_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_item_validation(client: AsyncClient) -> None:
    """Creating an item with invalid data returns 422."""
    response = await client.post("/api/v1/items", json={"name": ""})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_nonexistent_item(client: AsyncClient) -> None:
    """Getting a non-existent item returns 404."""
    response = await client.get("/api/v1/items/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
