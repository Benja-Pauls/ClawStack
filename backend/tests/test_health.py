"""Tests for health check endpoints.

All tests use a real PostgreSQL instance via testcontainers and
async httpx.AsyncClient (not FastAPI's sync TestClient) so the
async SQLAlchemy engine works end-to-end.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_health_check(client: AsyncClient) -> None:
    """GET /api/v1/health returns healthy status."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"
    assert "environment" in data


async def test_health_check_has_version(client: AsyncClient) -> None:
    """Health response includes a valid version string."""
    response = await client.get("/api/v1/health")
    data = response.json()
    parts = data["version"].split(".")
    assert len(parts) == 3, "Version should be semver format"


async def test_readiness_check(client: AsyncClient) -> None:
    """GET /api/v1/health/ready checks database connectivity."""
    response = await client.get("/api/v1/health/ready")
    data = response.json()

    assert "status" in data
    assert "version" in data
    assert "environment" in data
    assert "details" in data


async def test_health_response_schema(client: AsyncClient) -> None:
    """Verify health response matches the expected schema."""
    response = await client.get("/api/v1/health")
    data = response.json()

    required_fields = {"status", "version", "environment"}
    assert required_fields.issubset(set(data.keys()))
