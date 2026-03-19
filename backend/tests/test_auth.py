"""Tests for authentication endpoints.

Tests the full register → login → me flow using real Postgres
via testcontainers. Item-specific auth tests live in test_items.py.
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
