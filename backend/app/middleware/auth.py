"""Authentication middleware and dependencies.

This module re-exports the auth dependencies from routes.auth for
convenience, and provides an optional middleware that can enforce
authentication globally on specific path prefixes.

For most use cases, prefer using the dependency injection approach:
    from app.routes.auth import get_current_user

    @router.get("/protected")
    async def protected(user: UserInfo = Depends(get_current_user)):
        ...

The middleware approach below is useful when you want to enforce auth
on entire path prefixes without adding Depends() to every route.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.logging_config import get_logger

# Re-export for convenience
from app.routes.auth import UserInfo, get_current_user, get_optional_user  # noqa: F401

logger = get_logger(__name__)

# Paths that do NOT require authentication
PUBLIC_PATHS = {
    "/api/v1/health",
    "/api/v1/health/ready",
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/docs",
    "/api/redoc",
    "/api/openapi.json",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """Optional global authentication middleware.

    Enforces authentication on all /api/ routes except those in PUBLIC_PATHS.
    This is NOT included by default — add it to create_app() if you want
    global auth enforcement:

        from app.middleware.auth import AuthMiddleware
        application.add_middleware(AuthMiddleware)

    For most projects, the per-route Depends(get_current_user) approach
    is more flexible and recommended.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        path = request.url.path

        # Skip auth for non-API routes and public endpoints
        if not path.startswith("/api/") or path in PUBLIC_PATHS:
            return await call_next(request)

        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logger.warning(
                "auth_middleware_rejected",
                path=path,
                reason="missing_token",
            )
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Token validation is handled by the route-level dependency
        # This middleware only checks for token presence
        return await call_next(request)
