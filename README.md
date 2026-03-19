# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white" alt="Python 3.12+" />
  <img src="https://img.shields.io/badge/node-22+-339933?logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/badge/any_AI_agent-compatible-7c3aed" alt="Any AI agent compatible" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#key-patterns">Key Patterns</a> &nbsp;·&nbsp;
  <a href="#agent-integration">Agent Integration</a> &nbsp;·&nbsp;
  <a href="#deploy-to-aws">Deploy</a> &nbsp;·&nbsp;
  <a href="#design-decisions">Design Decisions</a> &nbsp;·&nbsp;
  <a href="docs/tutorial.md">Tutorial</a> &nbsp;·&nbsp;
  <a href="docs/faq.md">FAQ</a>
</p>

---

A fullstack template (FastAPI + React + Postgres + Terraform) designed to work well with AI coding agents. Clone it, run `make dev`, and start building. Your agent reads the `.skills/` directory and immediately understands the project structure, conventions, and how to add features.

The core idea: every AI coding session starts cold. The agent doesn't know your project layout, your conventions, or why you chose Alembic over raw SQL. It hallucinates paths and scaffolds patterns that don't match. SerpentStack solves this with `.skills/` — plain markdown files that any agent can read (Claude Code, Cursor, Copilot, whatever). No vendor lock-in, no special tooling.

**Stack:** FastAPI, Python 3.12, async SQLAlchemy 2.0, PostgreSQL, React 18, TypeScript, Vite, Tailwind CSS v4, Terraform (AWS). Tests run against real Postgres via testcontainers.

## Quick Start

Prerequisites: Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/Benja-Pauls/SerpentStack.git
cd SerpentStack
make init      # interactive setup — project name, cloud provider, DB config
make setup     # install Python (uv) and Node (npm) dependencies
make dev       # start Postgres + Redis + backend + frontend with hot reload
```

Backend runs at `http://localhost:8000`, frontend at `http://localhost:5173`. The app comes with a working Items CRUD, JWT auth (register/login), and ownership enforcement out of the box.

To verify everything works: `make verify` (runs lint + typecheck + tests for both backend and frontend).

## What You Get

```
backend/
  app/
    routes/        # API handlers — thin, delegate to services
    services/      # Business logic — async, no HTTPException, flush-only
    models/        # SQLAlchemy ORM (UUID pks, async sessions)
    schemas/       # Pydantic request/response models
    routes/auth.py # JWT auth: register, login, get_current_user
    worker/        # ARQ async task queue (Redis-backed)
  tests/           # pytest + testcontainers (real Postgres)
  migrations/      # Alembic

frontend/
  src/
    routes/        # Page components (Items, Login, Register)
    api/client.ts  # fetch-based API client with auth token injection
    contexts/      # React AuthContext + useAuth hook
    types/         # Auto-generated from OpenAPI via `make types`

infra/             # Terraform: App Runner, RDS, ECR, VPC
  modules/         # networking, ecr, rds, app-runner
  environments/    # dev, staging, prod

.skills/           # Agent context files (the important part)
```

## Key Patterns

These are the conventions your agent will follow (they're documented in `.skills/` and `.cursorrules`):

**Services flush, routes commit.** Services call `await db.flush()` but never `await db.commit()`. The route handler owns the transaction boundary. This lets you compose multiple service calls in a single transaction.

**Services never raise HTTPException.** They return `None` for not-found, `False` for permission denied, or domain objects for success. Routes translate these to HTTP status codes (404, 403, 200).

**Ownership enforcement.** Write operations (update, delete) require authentication via `Depends(get_current_user)` and check ownership. The pattern: service returns `True`/`None`/`False` for success/not-found/not-yours, route translates to 204/404/403.

**Auth is swappable.** Everything flows through `get_current_user()` which returns a `UserInfo(user_id, email, name, raw_claims)`. To swap JWT for Clerk, Auth0, or SSO, replace that one function. All protected routes keep working.

**Types flow from backend to frontend.** `make types` exports the FastAPI OpenAPI spec and generates TypeScript types via `openapi-typescript`. No manual schema duplication.

## Agent Integration

The `.skills/` directory contains markdown files that tell your agent how to work in this project. Any agent that can read files picks these up:

| File | What it tells the agent |
|---|---|
| `.skills/scaffold/SKILL.md` | How to add a new resource (model, schema, service, route, tests, frontend) |
| `.skills/auth/SKILL.md` | How auth works, how to protect routes, how to swap providers |
| `.skills/dev-server/SKILL.md` | How to detect and fix common dev server errors |
| `.skills/test/SKILL.md` | How to run tests, interpret failures |
| `.skills/db-migrate/SKILL.md` | How to create and run Alembic migrations |
| `.skills/deploy/SKILL.md` | How to build, push, and deploy to AWS |
| `.skills/git-workflow/SKILL.md` | Branch naming, commit conventions, PR process |
| `.cursorrules` | Architecture overview + conventions (auto-read by Cursor) |
| `.github/copilot-instructions.md` | Same conventions (auto-read by GitHub Copilot) |

Skills are plain markdown — edit them, delete ones you don't need, or add new ones by creating a `SKILL.md` in a new `.skills/` subdirectory.

## Commands

```bash
make dev             # Postgres + Redis + backend + frontend (hot reload)
make verify          # lint + typecheck + test (both ends) — run before pushing
make test            # just tests
make lint            # ruff (backend) + ESLint (frontend)
make types           # regenerate frontend TypeScript from OpenAPI spec
make migrate         # run Alembic migrations
make migrate-new name="add projects table"  # create a new migration
make seed            # seed DB with sample user + items
make worker          # start ARQ background task worker
make ui component=button  # add a shadcn/ui component
make deploy          # build + push + terraform apply (defaults to dev)
make deploy env=prod # deploy to prod (shows plan first)
```

## Deploy to AWS

Terraform modules for App Runner, RDS, ECR, and VPC networking are included in `infra/`. The deploy flow:

```bash
make deploy-init     # one-time: create S3 state bucket + DynamoDB lock table
make deploy          # build Docker images, push to ECR, terraform apply
make deploy env=prod # prod shows a plan for review before applying
```

The app is standard Docker containers. The AWS modules are a reference implementation — it runs anywhere containers run.

## Design Decisions

| Choice | Why |
|---|---|
| Async SQLAlchemy + asyncpg | AI apps multiplex LLM calls (2-30s each). Async handles thousands of concurrent connections vs ~40 with sync. |
| Testcontainers (real Postgres) | UUID columns, `ON CONFLICT`, JSONB don't exist in SQLite. Real DB in tests catches real bugs. |
| shadcn/ui (configured, zero components installed) | Copies source into your project — no runtime dependency. `make ui component=X` adds on demand. Delete `components.json` to remove entirely. |
| Domain exceptions in services | Services return `None`/`False`, routes translate to HTTP. Services stay reusable in CLI tools, workers, event handlers. |
| `openapi-typescript` | `make types` auto-generates frontend types. No manual schema mirroring. |
| Rate limiting (SlowAPI) | In-memory for dev, Redis for prod. Set `RATE_LIMIT_STORAGE_URI` to switch. |

## Contributing

Contributions welcome, especially: new skills in `.skills/`, Terraform modules for GCP/Azure, and config files for additional AI agents. For bugs and feature requests, [open an issue](https://github.com/Benja-Pauls/SerpentStack/issues).

## License

[MIT](LICENSE)
