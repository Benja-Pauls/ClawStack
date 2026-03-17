"""Health check endpoints.

These endpoints are used by load balancers, orchestrators (K8s),
and monitoring systems to verify application and dependency health.
"""

from __future__ import annotations

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.logging_config import get_logger
from app.models.base import get_engine
from app.schemas.health import HealthResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Basic health check",
)
async def health_check() -> HealthResponse:
    """Return basic application health status.

    This endpoint does not check dependencies and should always
    return quickly. Use /ready for dependency checks.
    """
    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/ready",
    response_model=HealthResponse,
    summary="Readiness check with dependency verification",
)
def readiness_check() -> HealthResponse | JSONResponse:
    """Check that the application and all dependencies are ready.

    Verifies database connectivity. Returns 503 if any dependency
    is unavailable.

    NOTE: Uses sync def because it calls synchronous SQLAlchemy engine.
    FastAPI runs this in a threadpool automatically.
    """
    db_healthy = False
    details: dict[str, str] = {}

    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            conn.commit()
        db_healthy = True
        details["database"] = "connected"
    except Exception as exc:
        logger.error("readiness_check_failed", error=str(exc), dependency="database")
        details["database"] = f"unavailable: {exc}"

    overall_status = "healthy" if db_healthy else "degraded"

    response = HealthResponse(
        status=overall_status,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        details=details,
    )

    if not db_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=response.model_dump(),
        )

    return response
