"""Rate limiting configuration using SlowAPI.

Provides a global rate limiter that can be applied to individual routes
or used as a default for the entire application. Rate limits are
configurable via the RATE_LIMIT environment variable.

Storage backend:
- Dev (default): in-memory (RATE_LIMIT_STORAGE_URI=memory://)
- Production: Redis (RATE_LIMIT_STORAGE_URI=redis://host:6379)

Usage on individual routes:
    from app.rate_limit import limiter

    @router.post("/expensive")
    @limiter.limit("10/minute")
    async def expensive_endpoint(request: Request):
        ...

The default rate limit (settings.RATE_LIMIT) applies to all routes
unless overridden per-route.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[settings.RATE_LIMIT],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    enabled=settings.ENVIRONMENT != "test",
)
