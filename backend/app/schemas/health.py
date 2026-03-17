"""Health check response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Response schema for health check endpoints."""

    status: str = Field(description="Health status: healthy, degraded, or unhealthy")
    version: str = Field(description="Application version")
    environment: str = Field(description="Runtime environment")
    details: dict[str, str] = Field(
        default_factory=dict,
        description="Dependency health details",
    )
