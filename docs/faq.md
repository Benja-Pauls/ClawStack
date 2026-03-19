# FAQ

## General

**Do I need a specific AI agent to use this?**

No. The `.skills/` context files are plain markdown that works with Claude Code, Cursor, Copilot, or any agent that can read files. No specific agent is required — any tool that can read markdown files will pick up the project context.

**Can I use a different database or cloud provider?**

Yes. Set `DATABASE_URL` in `.env` to any Postgres-compatible async connection string (Supabase, Neon, CockroachDB, self-hosted). Use the `postgresql+asyncpg://` scheme for the async driver. For a different cloud, the app is standard Docker containers — replace the `infra/` Terraform modules or deploy to Railway, Fly.io, or any container platform.

**How do I add a new API endpoint?**

Follow the [Build Your First Feature](tutorial.md) tutorial — it walks through adding a complete resource (model, migration, schemas, service, route, tests, frontend) end-to-end. You can also point your agent at the `scaffold` skill in `.skills/scaffold/SKILL.md` or the quick reference in `.skills/BACKEND.md`.

## Architecture

**Why async SQLAlchemy instead of sync?**

SerpentStack is designed for AI agent applications where LLM API calls block for 2-30+ seconds. With sync SQLAlchemy, each concurrent request occupies a thread — FastAPI's default threadpool of ~40 threads becomes the concurrency ceiling. Async SQLAlchemy lets the event loop handle thousands of concurrent connections on a single process, which is critical for apps that multiplex long-running inference calls alongside normal CRUD.

**Why PostgreSQL instead of SQLite for tests?**

UUID columns, `ON CONFLICT` upserts, JSONB operators, array types, and window functions behave differently (or don't exist) in SQLite. Testing against a real Postgres instance via testcontainers means CI catches Postgres-specific bugs, not staging. The container adds ~3 seconds to test startup but prevents an entire class of production failures.

**Why `asyncpg` instead of `psycopg`?**

asyncpg is a pure C async PostgreSQL driver purpose-built for asyncio. It's faster than psycopg's async mode for most workloads and has fewer compatibility edge cases with SQLAlchemy's async engine. psycopg2-binary is still included as a dev dependency for testcontainers, which needs it for container health checks.

**Why `uv` instead of pip/poetry?**

uv is written in Rust and resolves + installs dependencies in under a second — 10-100x faster than pip. For a template designed around fast cold-starts (clone → `make dev` in 30 seconds), that speed matters. It also replaces multiple tools (pip, pip-tools, virtualenv, pyenv) with a single binary.

**Why AWS App Runner instead of ECS/Fargate?**

App Runner handles auto-scaling, TLS, health checks, and deploys with zero infrastructure management. For rapid prototyping through to moderate production loads, it's the fastest path from Docker image to running service. Teams that need custom networking, sidecar containers, or GPU instances can swap the Terraform module for ECS/Fargate without changing the application code.

**Why shadcn/ui instead of Material UI, Chakra, etc.?**

shadcn/ui is the only component library that doesn't add a runtime dependency — it copies component source code into your project, so you own the files and can modify them freely. The template ships only the config file (`components.json`) and a `make ui component=X` Makefile target; no components are pre-installed, so there's zero bundle impact until you use one. To swap it for a different library, delete `components.json` and install your preferred alternative — the rest of the frontend (React Query, Router, Tailwind) is unaffected. See the [Customize section](../README.md#customize) in the README.

**Why built-in JWT auth instead of Clerk/Auth0?**

The built-in auth (register, login, bcrypt, JWT) works with zero external accounts or API keys. For prototyping, this means `make dev` gives you working auth immediately — no Clerk dashboard, no Auth0 tenant, no OAuth redirect configuration. When you're ready to swap, the `auth` skill in `.skills/auth/SKILL.md` walks through replacing one function (`get_current_user`) to use any external provider. All protected routes keep working because they depend on the `UserInfo` interface, not the implementation.

**Why in-memory rate limiting by default?**

The default `memory://` storage lets the template work without Redis for simple local development. In docker-compose (and production), `RATE_LIMIT_STORAGE_URI` is set to `redis://redis:6379` automatically, so rate limits survive restarts and work across multiple instances. You can configure any SlowAPI-compatible storage backend via that env var.
