"""Tests for authentication endpoints.

Tests the full register → login → me → protected-route flow
using real Postgres via testcontainers.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_register_and_login(client: AsyncClient) -> None:
    """Register a user, then login with the same credentials."""
    # Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "securepass123",
            "name": "Test User",
        },
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert reg_data["user"]["email"] == "newuser@example.com"
    assert reg_data["user"]["name"] == "Test User"

    # Login with same credentials
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "newuser@example.com", "password": "securepass123"},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "newuser@example.com"


async def test_register_duplicate_email(client: AsyncClient) -> None:
    """Registering with an existing email returns 409."""
    payload = {"email": "dupe@example.com", "password": "securepass123"}

    # First registration succeeds
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    # Second registration with same email fails
    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409


async def test_register_short_password(client: AsyncClient) -> None:
    """Registration with a password shorter than 8 characters returns 422."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "short"},
    )
    assert resp.status_code == 422


async def test_login_wrong_password(client: AsyncClient) -> None:
    """Login with wrong password returns 401."""
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={"email": "wrongpw@example.com", "password": "correctpass123"},
    )

    # Login with wrong password
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@example.com", "password": "wrongpass123"},
    )
    assert resp.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient) -> None:
    """Login with a non-existent email returns 401."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever123"},
    )
    assert resp.status_code == 401


async def test_get_me_with_token(client: AsyncClient) -> None:
    """GET /auth/me returns user info when authenticated."""
    # Register to get a token
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "meuser@example.com", "password": "securepass123", "name": "Me User"},
    )
    token = reg_resp.json()["access_token"]

    # Get current user
    me_resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "meuser@example.com"
    assert me_resp.json()["name"] == "Me User"


async def test_get_me_without_token(client: AsyncClient) -> None:
    """GET /auth/me without a token returns 401."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_get_me_with_invalid_token(client: AsyncClient) -> None:
    """GET /auth/me with an invalid token returns 401."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


async def test_delete_item_requires_auth(client: AsyncClient) -> None:
    """DELETE /items/{id} requires authentication."""
    # Create an item (no auth required for create)
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Auth Test Item"},
    )
    assert create_resp.status_code == 201
    item_id = create_resp.json()["id"]

    # Try to delete without auth
    del_resp = await client.delete(f"/api/v1/items/{item_id}")
    assert del_resp.status_code == 401

    # Register and get token
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "deleter@example.com", "password": "securepass123"},
    )
    token = reg_resp.json()["access_token"]

    # Delete with auth succeeds
    del_resp = await client.delete(
        f"/api/v1/items/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_resp.status_code == 204


async def test_create_item_sets_user_id_when_authenticated(client: AsyncClient) -> None:
    """Creating an item while authenticated sets user_id on the item."""
    # Register
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "owner@example.com", "password": "securepass123"},
    )
    token = reg_resp.json()["access_token"]
    user_id = reg_resp.json()["user"]["id"]

    # Create item with auth
    create_resp = await client.post(
        "/api/v1/items",
        json={"name": "Owned Item"},
        headers={"Authorization": f"Bearer {token}"},
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
