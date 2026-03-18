# ClawStack — GitHub Copilot Instructions

You are working on ClawStack, a fullstack template: FastAPI + React + PostgreSQL + Terraform.

## Architecture

- **Backend**: FastAPI, Python 3.12+, async SQLAlchemy 2.0 (asyncpg), Alembic, pydantic-settings, structlog, SlowAPI, Sentry SDK, ARQ
- **Frontend**: React 18, Vite, TypeScript (strict), Tailwind CSS v4, React Router, React Query, shadcn/ui
- **Cache/Queue**: Redis 7 (rate limiting, background tasks)
- **Database**: PostgreSQL 16 (Docker locally, RDS in production)
- **Testing**: pytest + testcontainers (real Postgres), httpx AsyncClient, Vitest

## Key Conventions

### Python / Backend
- All route handlers and service methods MUST be `async def`
- Use `AsyncSession` from `sqlalchemy.ext.asyncio` — never sync Session
- Services return `None` or domain values — NEVER raise `HTTPException` in services
- Services flush() but do NOT commit() — routes own the transaction boundary
- Routes translate service results to HTTP responses (None → 404, etc.) and call `await db.commit()` after mutations
- New models MUST be imported in `backend/app/models/__init__.py` for Alembic to detect them
- Use `get_logger(__name__)` with structured event-style logging: `logger.info("event_name", key=value)`
- UUID primary keys on all models — never integer IDs
- Pydantic schemas in `schemas/` — never expose ORM models directly
- API routes prefixed with `/api/v1/`
- Database engine is lazily initialized (not at import time)
- Line length: 100 characters
- Formatter/linter: ruff

### TypeScript / Frontend
- Strict mode — no `any` without justifying comment
- Named exports for hooks and utilities (components may use default exports)
- Types auto-generated from OpenAPI spec via `make types` — prefer generated types over hand-written
- Use React Query for data fetching, React Router for routing

### Database
- Async driver: `postgresql+asyncpg://`
- All models inherit from `Base` (UUID pk, created_at, updated_at)
- Migrations via Alembic (async engine)

### Testing
- Backend tests use testcontainers with real PostgreSQL — Docker must be running
- Use `@pytest.mark.asyncio` and `AsyncClient` for endpoint tests
- Frontend tests use Vitest

## Adding a New Endpoint

1. Create SQLAlchemy model in `backend/app/models/` and import it in `models/__init__.py`
2. Create Pydantic schemas in `backend/app/schemas/`
3. Create async service in `backend/app/services/` (flush only, no commit, return None for not-found, no HTTPException)
4. Create async route in `backend/app/routes/` (translate service results to HTTP, commit after mutations)
5. Register router in `backend/app/main.py`
6. Add tests in `backend/tests/`
7. Run `make types` to update frontend TypeScript types

## Common Commands

```bash
make dev        # Start Postgres + Redis + backend + frontend
make test       # Run all tests (requires Docker)
make lint       # ruff + ESLint
make types      # Auto-generate frontend types from OpenAPI spec
make migrate    # Run database migrations
make seed       # Seed database with sample data
make worker     # Start ARQ background task worker
make ui component=X  # Add a shadcn/ui component
```
