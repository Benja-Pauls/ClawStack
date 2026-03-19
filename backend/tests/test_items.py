"""Tests for item CRUD endpoints.

Tests the full create → read → update → list → delete lifecycle,
validation, and not-found handling using real Postgres via testcontainers.
"""

from __future__ import annotations

from httpx import AsyncClient


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

    # Delete requires auth — register a user first
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "crud-test@example.com", "password": "testpass123"},
    )
    token = reg_resp.json()["access_token"]

    delete_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    # Verify deleted
    get_resp = await client.get(f"/api/v1/items/{item_id}")
    assert get_resp.status_code == 404


async def test_create_item_validation(client: AsyncClient) -> None:
    """Creating an item with invalid data returns 422."""
    response = await client.post("/api/v1/items", json={"name": ""})
    assert response.status_code == 422


async def test_get_nonexistent_item(client: AsyncClient) -> None:
    """Getting a non-existent item returns 404."""
    response = await client.get("/api/v1/items/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
