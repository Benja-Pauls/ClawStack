# FAQ

## General

**Do I need OpenClaw to use this?**

No. The `.skills/` context files are plain markdown that works with Claude Code, Cursor, Copilot, or any agent that can read files. OpenClaw adds persistent automation (dev server watching, one-command deploy skills) but isn't required.

**Do I need NemoClaw?**

No. NemoClaw is optional and adds sandboxed execution via OpenShell and privacy-routed local inference via Nemotron models. The config in `.nemoclaw/` activates when NemoClaw is installed.

**Can I use a different database or cloud provider?**

Yes. Set `DATABASE_URL` in `.env` to any Postgres-compatible async connection string (Supabase, Neon, CockroachDB, self-hosted). Use the `postgresql+asyncpg://` scheme for the async driver. For a different cloud, the app is standard Docker containers — replace the `infra/` Terraform modules or deploy to Railway, Fly.io, or any container platform.

**How do I add a new API endpoint?**

Follow the [Build Your First Feature](tutorial.md) tutorial — it walks through adding a complete resource (model, migration, schemas, service, route, tests, frontend) end-to-end. You can also point your agent at the `scaffold` skill in `.skills/scaffold/SKILL.md` or the quick reference in `.skills/BACKEND.md`.

## Architecture

**Why async SQLAlchemy instead of sync?**

ClawStack is designed for AI agent applications where LLM API calls block for 2-30+ seconds. With sync SQLAlchemy, each concurrent request occupies a thread — FastAPI's default threadpool of ~40 threads becomes the concurrency ceiling. Async SQLAlchemy lets the event loop handle thousands of concurrent connections on a single process, which is critical for apps that multiplex long-running inference calls alongside normal CRUD.

**Why PostgreSQL instead of SQLite for tests?**

UUID columns, `ON CONFLICT` upserts, JSONB operators, array types, and window functions behave differently (or don't exist) in SQLite. Testing against a real Postgres instance via testcontainers means CI catches Postgres-specific bugs, not staging. The container adds ~3 seconds to test startup but prevents an entire class of production failures.

**Why `asyncpg` instead of `psycopg`?**

asyncpg is a pure C async PostgreSQL driver purpose-built for asyncio. It's faster than psycopg's async mode for most workloads and has fewer compatibility edge cases with SQLAlchemy's async engine. psycopg2-binary is still included as a dev dependency for testcontainers, which needs it for container health checks.

**Why `uv` instead of pip/poetry?**

uv is written in Rust and resolves + installs dependencies in under a second — 10-100x faster than pip. For a template designed around fast cold-starts (clone → `make dev` in 30 seconds), that speed matters. It also replaces multiple tools (pip, pip-tools, virtualenv, pyenv) with a single binary.

**Why AWS App Runner instead of ECS/Fargate?**

App Runner handles auto-scaling, TLS, health checks, and deploys with zero infrastructure management. For rapid prototyping through to moderate production loads, it's the fastest path from Docker image to running service. Teams that need custom networking, sidecar containers, or GPU instances can swap the Terraform module for ECS/Fargate without changing the application code.

**Why no component library (shadcn/ui, Radix)?**

Deliberate minimalism. A component library is the highest-leverage addition for rapid UI development, but it's also the most opinionated choice in a template. We provide Tailwind v4 and a clean component structure. Adding shadcn/ui is a 5-minute `npx shadcn@latest init` away, and we'd rather you choose the library that fits your design system than force one.

**Why rate limiting with in-memory storage?**

The default `memory://` storage works for single-instance deployments. For multi-instance production, configure `RATE_LIMIT_STORAGE_URI` to point at Redis (e.g., `redis://localhost:6379`). We ship with in-memory so the template works without Redis out of the box.
