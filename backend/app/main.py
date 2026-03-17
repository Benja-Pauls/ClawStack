"""FastAPI application factory.

Uses the factory pattern so the app can be configured differently
for testing, development, and production.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.logging_config import get_logger, setup_logging
from app.middleware.logging import LoggingMiddleware
from app.routes import auth, health, items

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager.

    Handles startup and shutdown events.
    """
    # Startup
    setup_logging()
    logger.info(
        "application_starting",
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        log_level=settings.LOG_LEVEL,
    )
    yield
    # Shutdown
    logger.info("application_shutting_down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured FastAPI application instance.
    """
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/api/docs" if settings.is_dev else None,
        redoc_url="/api/redoc" if settings.is_dev else None,
        openapi_url="/api/openapi.json" if settings.is_dev else None,
        lifespan=lifespan,
    )

    # CORS middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom request/response logging middleware
    application.add_middleware(LoggingMiddleware)

    # Include routers
    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(items.router)

    return application


# Module-level app instance for uvicorn
app = create_app()
