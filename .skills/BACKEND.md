---
skill: backend
version: 2
---

# Backend Guide (FastAPI)

## Entry Point

`backend/app/main.py` contains `create_app()` factory that configures middleware, routes, rate limiting, and startup/shutdown hooks.

## Adding a New Endpoint

1. Create route file in `backend/app/routes/` (one file per domain, e.g., `routes/users.py`)
2. Define Pydantic request/response schemas in `backend/app/schemas/`
3. Implement business logic in `backend/app/services/` (never raise HTTPException here)
4. Register the router in `main.py` via `app.include_router(router)`

All routes MUST be prefixed with `/api/v1/`. Use APIRouter with tags for OpenAPI grouping.

## Router Pattern

Route handlers use `async def` with async SQLAlchemy. This is critical for AI agent apps where LLM API calls block for 2-30+ seconds — async handles thousands of concurrent connections vs. ~40 with a sync threadpool.

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import get_db

router = APIRouter(prefix="/api/v1/items", tags=["items"])

@router.get("", response_model=list[ItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    return await item_service.list_items(db)
```

## Service Layer Pattern

Services return `None` or domain values — they never raise `HTTPException`. Services **flush but do not commit** — the route layer owns the transaction boundary. Routes translate:
- `None` → 404
- `False` → 404
- Domain exceptions → appropriate HTTP status
- On success, routes call `await db.commit()`

This keeps services composable (multiple service calls in one transaction) and reusable in CLI tools, background workers, and event handlers. `Depends(get_db)` is cached per-request, so the route's `db` and the service's `self.db` are the same session.

## Authentication

Local JWT auth in `routes/auth.py` with register, login, and token validation. Uses bcrypt password hashing via `services/user.py`. Protect routes with `Depends(get_current_user)` — returns a `UserInfo` with `user_id`, `email`, `name`. For optional auth, use `Depends(get_optional_user)`. To swap to Clerk, Auth0, or another provider, see `.skills/auth/SKILL.md`.

## Rate Limiting

Global rate limiting via SlowAPI in `app/rate_limit.py`. Default: `100/minute` per IP (configurable via `RATE_LIMIT` env var). Override per-route with `@limiter.limit("10/minute")`.

## Pydantic Patterns

- `schemas/` for API request/response models (use `Base`, `Create`, `Update`, `Response` suffix pattern)
- `models/` for SQLAlchemy ORM models
- Always derive response schemas from base; never expose ORM models directly

## Structured Logging

```python
from app.logging_config import get_logger
logger = get_logger(__name__)
logger.info("event_name", key="value", request_id=request_id)
```

Always log as JSON. Include `request_id` from middleware. Use event-style naming.

## Configuration

`backend/app/config.py` uses pydantic-settings. Nested config uses `__` delimiter:
- `DB__POOL_SIZE`, `DB__ECHO`
- `CORS__ALLOW_METHODS`, `CORS__ALLOW_HEADERS` (tightened per-environment)
- `RATE_LIMIT` (e.g., `100/minute`, `1000/hour`)

## Database Engine

The async engine is lazily initialized via `get_engine()` in `models/base.py` (not at import time).
This avoids connection errors during linting, testing, or when Postgres isn't running. Uses `asyncpg` driver.

## Type Generation

Frontend types are auto-generated from the OpenAPI spec:

```bash
make types    # Generates frontend/src/types/api.generated.ts
```

Run this after adding or changing backend schemas.

## Testing

```bash
cd backend && uv run pytest                    # Run all tests
cd backend && uv run pytest tests/test_api.py  # Run specific file
cd backend && uv run pytest -k "test_create"   # Run by name pattern
```

Tests use a real PostgreSQL instance via testcontainers and async `httpx.AsyncClient`. Docker must be running. See `tests/conftest.py` for fixtures.

## Dependencies

Managed with `uv`. Add packages: `uv add <package>`. Lock file: `uv.lock`.
