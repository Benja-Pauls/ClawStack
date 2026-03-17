---
skill: backend
version: 1
---

# Backend Guide (FastAPI)

## Entry Point

`backend/app/main.py` contains `create_app()` factory that configures middleware, routes, and startup hooks.

## Adding a New Endpoint

1. Create route file in `backend/app/routes/` (one file per domain, e.g., `routes/users.py`)
2. Define Pydantic request/response schemas in `backend/app/schemas/`
3. Implement business logic in `backend/app/services/`
4. Register the router in `main.py` via `app.include_router(router)`

All routes MUST be prefixed with `/api/v1/`. Use APIRouter with tags for OpenAPI grouping.

## Router Pattern

Route handlers use sync `def` (not `async def`) because the service layer uses synchronous
SQLAlchemy. FastAPI automatically runs sync handlers in a threadpool, avoiding event loop blocking.

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.base import get_db

router = APIRouter(prefix="/api/v1/items", tags=["items"])

@router.get("", response_model=list[ItemResponse])
def list_items(db: Session = Depends(get_db)):
    return item_service.list_items(db)
```

## Authentication

Pluggable auth dependency in `routes/auth.py`. Supports custom JWT (fully functional),
Clerk and Auth0 (stubs — JWKS validation not yet implemented, see module docstring for instructions).
Use `Depends(get_current_user)` on protected routes. Configure provider via `AUTH_PROVIDER` env var.

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
- `DB__POOL_SIZE`, `DB__ECHO`, `AUTH__PROVIDER`, `AUTH__JWKS_URL`

## Database Engine

The engine is lazily initialized via `get_engine()` in `models/base.py` (not at import time).
This avoids connection errors during linting, testing, or when Postgres isn't running.

## Testing

```bash
cd backend && uv run pytest                    # Run all tests
cd backend && uv run pytest tests/test_api.py  # Run specific file
cd backend && uv run pytest -k "test_create"   # Run by name pattern
```

Tests use in-memory SQLite with `TestClient`. See `tests/conftest.py` for fixtures.

## Dependencies

Managed with `uv`. Add packages: `uv add <package>`. Lock file: `uv.lock`.
