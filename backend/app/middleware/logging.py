"""Request/response logging middleware.

Logs every HTTP request with method, path, status code, and duration
as structured JSON. This is essential for agent-parseable observability.
"""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

import structlog

from app.logging_config import get_logger

logger = get_logger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs structured request/response information.

    Each request gets a unique request_id for correlation. Logs include:
    - HTTP method and path
    - Response status code
    - Request duration in milliseconds
    - Client IP address
    - Request ID for correlation
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Bind request_id to structlog context for all logs in this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        # Skip logging for health checks to reduce noise
        is_health = request.url.path.startswith("/api/v1/health")

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                duration_ms=round(duration_ms, 2),
                client_ip=request.client.host if request.client else None,
            )
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000

        # Add request_id to response headers for client-side correlation
        response.headers["X-Request-ID"] = request_id

        if not is_health:
            log_method = logger.info if response.status_code < 400 else logger.warning
            log_method(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
                client_ip=request.client.host if request.client else None,
            )

        return response
