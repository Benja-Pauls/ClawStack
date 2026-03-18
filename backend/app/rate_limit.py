"""Rate limiting configuration using SlowAPI.

Provides a global rate limiter that can be applied to individual routes
or used as a default for the entire application. Rate limits are
configurable via the RATE_LIMIT environment variable.

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
    storage_uri="memory://",
)
