"""Tests for item CRUD endpoints.

Tests the full create → read → update → list → delete lifecycle,
validation, not-found handling, auth requirements, and ownership
enforcement using real Postgres via testcontainers.
"""

from httpx import AsyncClient

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _register(client: AsyncClient, email: str) -> tuple[str, str]:
    """Register a user and return (token, user_id)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    data = resp.json()
    return data["access_token"], data["user"]["id"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Basic CRUD
# ---------------------------------------------------------------------------


async def test_items_crud_lifecycle(client: AsyncClient) -> None:
    """Test full CRUD lifecycle for items endpoint."""
    token, _ = await _register(client, "crud-lifecycle@example.com")
    headers = _auth(token)

    # Create (authenticated so the item gets an owner)
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Test Item", "description": "A test item"},
        headers=headers,
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

    # Update (requires auth)
    update_resp = await client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "Updated Item"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Updated Item"

    # List
    list_resp = await client.get("/api/v1/items")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] >= 1
    assert len(data["items"]) >= 1

    # Delete (requires auth)
    delete_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers=headers,
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


# ---------------------------------------------------------------------------
# Auth requirements
# ---------------------------------------------------------------------------


async def test_delete_item_requires_auth(client: AsyncClient) -> None:
    """DELETE /items/{id} without a token returns 401."""
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Auth Test Item"},
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/items/{item_id}")
    assert del_resp.status_code == 401


async def test_update_item_requires_auth(client: AsyncClient) -> None:
    """PUT /items/{id} without a token returns 401."""
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Auth Test Item"},
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "Should Fail"},
    )
    assert update_resp.status_code == 401


async def test_create_item_sets_user_id_when_authenticated(client: AsyncClient) -> None:
    """Creating an item while authenticated sets user_id on the item."""
    token, user_id = await _register(client, "owner-test@example.com")

    # Create item with auth
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Owned Item"},
        headers=_auth(token),
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["user_id"] == user_id

    # Create item without auth — user_id should be null
    anon_resp = await client.post(
        "/api/v1/items",
        json={"name": "Anonymous Item"},
    )
    assert anon_resp.status_code == 201
    assert anon_resp.json()["user_id"] is None


# ---------------------------------------------------------------------------
# Ownership enforcement (403)
# ---------------------------------------------------------------------------


async def test_delete_other_users_item_returns_403(client: AsyncClient) -> None:
    """Deleting an item owned by another user returns 403."""
    token_a, _ = await _register(client, "user-a-del@example.com")
    token_b, _ = await _register(client, "user-b-del@example.com")

    # User A creates an item
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "User A's Item"},
        headers=_auth(token_a),
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    # User B tries to delete it → 403
    del_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers=_auth(token_b),
    )
    assert del_resp.status_code == 403

    # User A can still delete it → 204
    del_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers=_auth(token_a),
    )
    assert del_resp.status_code == 204


async def test_update_other_users_item_returns_403(client: AsyncClient) -> None:
    """Updating an item owned by another user returns 403."""
    token_a, _ = await _register(client, "user-a-upd@example.com")
    token_b, _ = await _register(client, "user-b-upd@example.com")

    # User A creates an item
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "User A's Item"},
        headers=_auth(token_a),
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    # User B tries to update it → 403
    update_resp = await client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "Hijacked"},
        headers=_auth(token_b),
    )
    assert update_resp.status_code == 403

    # User A can still update it → 200
    update_resp = await client.put(
        f"/api/v1/items/{item_id}",
        json={"name": "Properly Updated"},
        headers=_auth(token_a),
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Properly Updated"


async def test_delete_unowned_item_succeeds(client: AsyncClient) -> None:
    """Deleting an item with no owner (created anonymously) succeeds for any authenticated user."""
    token, _ = await _register(client, "unowned-del@example.com")

    # Create item without auth (no owner)
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Nobody's Item"},
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]
    assert create_resp.json()["user_id"] is None

    # Any authenticated user can delete an unowned item
    del_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers=_auth(token),
    )
    assert del_resp.status_code == 204
