---
skill: project-overview
version: 2
---

# SerpentStack Project Overview

SerpentStack is a fullstack template combining FastAPI, React, PostgreSQL, and Terraform with AI agent integration.

## Directory Structure

```
backend/          # FastAPI Python backend (uv package manager)
frontend/         # React + Vite + TypeScript + Tailwind frontend
infra/            # Terraform IaC for AWS deployment
scripts/          # CLI tools (init, deploy, deploy-init)
.skills/          # Agent context files + action skills (this directory)
```

## Tech Stack

- **Backend**: FastAPI, Python 3.12+, uv, async SQLAlchemy 2.0 (asyncpg), Alembic, pydantic-settings, structlog, SlowAPI, PyJWT, Sentry SDK
- **Frontend**: React 18, Vite, TypeScript (strict mode), Tailwind CSS v4, React Router, React Query, shadcn/ui (pre-configured)
- **Database**: PostgreSQL 16 (Docker locally, RDS in production)
- **Cache/Queue**: Redis 7 (rate limiting storage, ARQ task queue)
- **Background Tasks**: ARQ (async task queue on Redis)
- **Testing**: pytest + testcontainers (real Postgres), httpx AsyncClient, Vitest
- **Infrastructure**: Terraform, AWS (App Runner, ECR, RDS, S3)
- **Observability**: Sentry (error tracking + tracing, optional via `SENTRY_DSN`)
- **AI Agents**: Works with any agent via `.skills/` context files

## Running Locally

```bash
make dev              # Start all services (Postgres + Redis + backend + frontend)
docker compose up     # Alternative: run via Docker Compose
```

## Key Conventions

- API routes are versioned under `/api/v1/`
- All logging is structured JSON via structlog
- Request/response models use Pydantic schemas
- TypeScript strict mode is enforced in frontend
- UUID primary keys on all database tables
- snake_case for Python/SQL, camelCase for TypeScript
- Route handlers use `async def` with async SQLAlchemy (asyncpg driver)
- Services return `None`/domain values — never raise HTTPException (routes translate)
- Database engine is lazily initialized (not at import time)
- Frontend types auto-generated from OpenAPI spec (`make types`)
- CORS methods and headers are tightened per-environment (not wildcard)
- Rate limiting via SlowAPI (configurable via `RATE_LIMIT` env var, `RATE_LIMIT_STORAGE_URI` for backend)
- Production validation rejects insecure defaults (SECRET_KEY, localhost DB) in staging/prod
- SSE streaming endpoint at `/api/v1/stream` for LLM responses

## Environment Configuration

- Copy `.env.example` to `.env` for local development
- Backend config via pydantic-settings: nested vars use `__` delimiter (e.g., `DB__POOL_SIZE`)
- Frontend env vars prefixed with `VITE_`
- `CORS_ORIGINS` accepts JSON array format: `["http://localhost:5173"]`
- `DATABASE_URL` uses async driver: `postgresql+asyncpg://...`

## Common Commands

```bash
make dev              # Start dev environment (Postgres + Redis + backend + frontend)
make test             # Run all tests (requires Docker for Postgres)
make lint             # Lint backend + frontend
make migrate          # Run database migrations
make types            # Auto-generate frontend types from OpenAPI spec
make seed             # Seed database with sample data
make worker           # Start ARQ background task worker
make ui component=X   # Add a shadcn/ui component (e.g., make ui component=button)
make deploy env=dev   # Deploy to environment
```

## Agent Skills

This directory contains both context files (flat markdown) and action skills (subdirectories with SKILL.md). Any agent can read them.

| Skill | File | What it does |
|---|---|---|
| Dev Server | `.skills/dev-server/SKILL.md` | Start, monitor, and auto-fix the dev environment |
| Deploy | `.skills/deploy/SKILL.md` | Build Docker images, push to ECR, run Terraform |
| Scaffold | `.skills/scaffold/SKILL.md` | Generate boilerplate for new endpoints and pages |
| Auth | `.skills/auth/SKILL.md` | Understand auth, protect routes, swap providers |
| DB Migrate | `.skills/db-migrate/SKILL.md` | Create and run Alembic migrations |
| Test | `.skills/test/SKILL.md` | Run and interpret pytest and vitest |
| Git Workflow | `.skills/git-workflow/SKILL.md` | Branches, conventional commits, PRs |
| Find Skills | `.skills/find-skills/SKILL.md` | Discover and create skills for new capabilities |

When you need to perform one of these tasks, read the corresponding SKILL.md and follow its instructions.

## Additional Context Files

- `AI-INTEGRATION.md` — How to add LLM/AI features to the app (API keys, streaming, tool use)
- `BACKEND.md` — FastAPI patterns, routing, auth, logging, config, rate limiting
- `FRONTEND.md` — React, routing, API client, data fetching, styling
- `DATABASE.md` — SQLAlchemy async models, Alembic migrations, conventions
- `DEPLOY.md` — Terraform modules, Docker builds, environment management
