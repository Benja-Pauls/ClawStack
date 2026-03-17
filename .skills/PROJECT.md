---
skill: project-overview
version: 1
---

# ClawStack Project Overview

ClawStack is a fullstack template combining FastAPI, React, PostgreSQL, and Terraform with AI agent integration.

## Directory Structure

```
backend/          # FastAPI Python backend (uv package manager)
frontend/         # React + Vite + TypeScript + Tailwind frontend
infra/            # Terraform IaC for AWS deployment
scripts/          # CLI tools (init, deploy, deploy-init)
.openclaw/        # OpenClaw agent configuration and skills
.skills/          # Agent context files (this directory)
.nemoclaw/        # NemoClaw sandbox configuration
```

## Tech Stack

- **Backend**: FastAPI, Python 3.12+, uv, SQLAlchemy (sync), Alembic, pydantic-settings, structlog, PyJWT
- **Frontend**: React 18, Vite, TypeScript (strict mode), Tailwind CSS v4, React Router, React Query
- **Database**: PostgreSQL 16 (Docker locally, RDS in production)
- **Infrastructure**: Terraform, AWS (App Runner, ECR, RDS, S3)
- **AI Agents**: OpenClaw, NemoClaw integration points

## Running Locally

```bash
make dev              # Start all services (backend + frontend + db)
docker compose up     # Alternative: run via Docker Compose
```

## Key Conventions

- API routes are versioned under `/api/v1/`
- All logging is structured JSON via structlog
- Request/response models use Pydantic schemas
- TypeScript strict mode is enforced in frontend
- UUID primary keys on all database tables
- snake_case for Python/SQL, camelCase for TypeScript
- Route handlers use sync `def` (not `async def`) when calling sync SQLAlchemy
- Database engine is lazily initialized (not at import time)

## Environment Configuration

- Copy `.env.example` to `.env` for local development
- Backend config via pydantic-settings: nested vars use `__` delimiter (e.g., `DB__POOL_SIZE`)
- Frontend env vars prefixed with `VITE_`
- `CORS_ORIGINS` accepts JSON array format: `["http://localhost:5173"]`

## Common Commands

```bash
make dev              # Start dev environment
make test             # Run all tests
make lint             # Lint backend + frontend
make migrate          # Run database migrations
make deploy env=dev   # Deploy to environment
```

## Agent Skills

This directory contains both context files (flat markdown) and action skills (subdirectories with SKILL.md). Any agent can read them. OpenClaw auto-discovers the SKILL.md files.

| Skill | File | What it does |
|---|---|---|
| Dev Server | `.skills/dev-server/SKILL.md` | Start, monitor, and auto-fix the dev environment |
| Deploy | `.skills/deploy/SKILL.md` | Build Docker images, push to ECR, run Terraform |
| Scaffold | `.skills/scaffold/SKILL.md` | Generate boilerplate for new endpoints and pages |
| DB Migrate | `.skills/db-migrate/SKILL.md` | Create and run Alembic migrations |
| Test | `.skills/test/SKILL.md` | Run and interpret pytest and vitest |
| Git Workflow | `.skills/git-workflow/SKILL.md` | Branches, conventional commits, PRs |
| Find Skills | `.skills/find-skills/SKILL.md` | Discover community skills from ClawHub |

When you need to perform one of these tasks, read the corresponding SKILL.md and follow its instructions.

## Additional Context Files

- `AI-INTEGRATION.md` — How to add LLM/AI features to the app (API keys, streaming, tool use)
- `BACKEND.md` — FastAPI patterns, routing, auth, logging, config
- `FRONTEND.md` — React, routing, API client, data fetching, styling
- `DATABASE.md` — SQLAlchemy models, Alembic migrations, conventions
- `DEPLOY.md` — Terraform modules, Docker builds, environment management
