# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack?label=release&color=blue" alt="Release" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/python-3.12+-3776AB?logo=python&logoColor=white" alt="Python 3.12+" />
  <img src="https://img.shields.io/badge/node-22+-339933?logo=node.js&logoColor=white" alt="Node 22+" />
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &nbsp;&middot;&nbsp;
  <a href="#project-specific-skills">Skills</a> &nbsp;&middot;&nbsp;
  <a href="#persistent-agents">Persistent Agents</a> &nbsp;&middot;&nbsp;
  <a href="#patterns">Patterns</a> &nbsp;&middot;&nbsp;
  <a href="#commands">Commands</a> &nbsp;&middot;&nbsp;
  <a href="#deploy">Deploy</a> &nbsp;&middot;&nbsp;
  <a href="#design-decisions">Design Decisions</a>
</p>

---

Generic skills teach agents how to code. Project-specific skills teach agents how to code **like your team does** — your transaction patterns, your auth conventions, your ownership enforcement, your test infrastructure. There are thousands of generic skills in [marketplaces](https://github.com/anthropics/skills). None of them know your codebase.

SerpentStack is the open-source standard for AI-driven development. It gives your IDE agents project-specific skills so they write code matching your conventions, and configures persistent background agents ([OpenClaw](https://docs.openclaw.ai)) that continuously watch your dev server, catch errors, run tests, and maintain those skills as your project evolves.

**Starting a new project?** `serpentstack stack new` scaffolds a production-ready FastAPI + React + Postgres + Terraform stack with project-specific skills and persistent agent configs already written.

**Already have a project?** `serpentstack skills init` downloads the base skills and persistent agent configs into your codebase. Then ask your IDE agent to generate project-specific skills tailored to your conventions.

Skills use the [Agent Skills open standard](https://agentskills.io/home) (Claude Code, Codex, Cursor, Copilot, Gemini CLI). Persistent agents use the [OpenClaw workspace](https://docs.openclaw.ai/concepts/agent-workspace) standard.

```bash
# New project — full template with skills + persistent agent configs
npm install -g serpentstack              # requires Node 22+
serpentstack stack new my-app            # scaffolds the full stack
cd my-app && make setup && make dev

# Existing project — add AI-driven development to any codebase
cd your-project
serpentstack skills init                 # downloads skills + persistent agent configs
# Then tell your IDE agent: "generate skills for my project"
serpentstack skills persistent --start   # start background agent (watches logs, runs tests)
```

## Quick Start

Prerequisites: Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/Benja-Pauls/SerpentStack.git
cd SerpentStack
make init      # interactive setup — project name, DB config
make setup     # install Python (uv) and Node (npm) dependencies
make dev       # start Postgres + Redis + backend + frontend with hot reload
```

Backend at `localhost:8000`, frontend at `localhost:5173`. Working Items CRUD, JWT auth (register/login), and ownership enforcement out of the box. `make verify` runs lint + typecheck + tests for both ends.

## Project-Specific Skills

There are thousands of generic skills in [marketplaces](https://github.com/anthropics/skills) — "how to write tests," "how to create React components," "how to deploy to AWS." Those teach agents how to write Python. These skills teach agents how to write Python **the way this project does it**:

| Skill | What it encodes |
|---|---|
| `scaffold/SKILL.md` | Full end-to-end resource generation — model, schema, service (flush-only, domain returns), route (commit + ownership), tests (testcontainers), frontend (typed API client + hooks) |
| `auth/SKILL.md` | The `UserInfo` contract, `get_current_user` dependency, how to protect routes, how to swap JWT for Clerk/Auth0/SSO without changing route code |
| `test/SKILL.md` | Real Postgres via testcontainers, the savepoint-rollback isolation pattern, `asyncio_mode = "auto"` (no decorators needed), how to interpret failures |
| `db-migrate/SKILL.md` | Alembic workflow — create, review, apply, rollback, seed data |
| `dev-server/SKILL.md` | Error detection patterns for backend (structured JSON logs) and frontend (Vite/React), with the auto-fix workflow |
| `deploy/SKILL.md` | Docker build, ECR push, Terraform plan/apply, health check verification, rollback procedure |
| `git-workflow/SKILL.md` | Branch naming, conventional commits, PR format, pre-push checklist |
| `find-skills/SKILL.md` | How to discover community skills, evaluate them, create new project-specific ones, and adapt external guides to this project's conventions |
| `generate-skills/SKILL.md` | **For existing projects.** Interviews you about your codebase conventions and produces a full `.skills/` directory tailored to your project |
| `model-routing/SKILL.md` | Delegate code generation to on-device models (Ollama) while keeping cloud models for orchestration — 10-50x cost reduction on coding-heavy sessions |

Agent-specific config files (`.cursorrules`, `.github/copilot-instructions.md`) are also included — auto-loaded by their respective agents with the architecture overview and key conventions.

### Why These Skills Work

- **Complete templates, not descriptions.** `scaffold/SKILL.md` contains the actual files an agent should produce — real imports, real type signatures, real test assertions. The agent doesn't need to infer anything.
- **The full chain, not just parts.** Each resource covers model -> schema -> service -> route -> register router -> migration -> tests -> frontend types -> API client -> hooks -> page -> route registration.
- **Verification built in.** Every skill ends with how to check the work: `make verify`, specific test commands, expected outputs.
- **Composable.** Skills reference each other — scaffold points to auth for ownership details, test points to scaffold for service return patterns, find-skills lists what's already covered.

## Persistent Agents

IDE agents help when you ask. Persistent agents help before you ask — watching your dev server, catching errors in real time, running tests on a schedule, and flagging when skills go stale because your code changed.

SerpentStack ships with an [OpenClaw](https://docs.openclaw.ai) workspace in `.openclaw/`:

| File | What it does |
|---|---|
| `SOUL.md` | Agent identity — knows the project's architecture, conventions, and patterns. Follows the same rules encoded in `.skills/`. |
| `HEARTBEAT.md` | Scheduled checks — dev server health (30s), log scanning for errors (60s), test suite (5min), lint + typecheck (15min), skill freshness (1hr). |
| `AGENTS.md` | Workspace config — model routing (Haiku for heartbeats, Sonnet for analysis), tool access, operating rules. |

```bash
make persistent   # installs OpenClaw if needed, starts the background agent
```

The persistent agent reads your `.skills/` on startup, so it understands the same conventions your IDE agent does. When it detects an error, it reports the problem with full context — file path, line number, what changed, proposed fix — so you can review and approve rather than debug from scratch.

### Two Agent Architectures

SerpentStack supports two agent types with different standards:

| | IDE / Sidecar Agents | Persistent Agents |
|---|---|---|
| **Standard** | [Agent Skills](https://agentskills.io/home) (SKILL.md) | [OpenClaw](https://docs.openclaw.ai) (SOUL.md + HEARTBEAT.md) |
| **Agents** | Claude Code, Codex, Cursor, Copilot, Gemini CLI | OpenClaw gateway |
| **Mode** | On-demand: you ask, it acts | Always-on: it watches, it tells you |
| **Directory** | `.skills/` | `.openclaw/` |
| **Format** | YAML frontmatter + markdown instructions | Workspace files (identity, schedule, config) |

Both are plain text. Both are version-controlled. Neither requires vendor lock-in.

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
    api/client.ts  # fetch wrapper with auth token injection
    contexts/      # React AuthContext + useAuth hook
    types/         # Auto-generated from OpenAPI via make types

infra/             # Terraform: App Runner, RDS, ECR, VPC
.skills/           # IDE agent skills (Agent Skills standard)
.openclaw/         # Persistent agent workspace (OpenClaw)
```

## Patterns

These are the conventions encoded in `.skills/` and `.cursorrules`. An agent learns them on first read.

**Services flush, routes commit.** Services call `await db.flush()` but never `db.commit()`. The route handler owns the transaction boundary. This lets you compose multiple service calls atomically.

**Services never raise HTTPException.** They return `None` for not-found, `False` for not-yours, or a domain object for success. Routes translate: `None` -> 404, `False` -> 403, object -> 200.

**Ownership enforcement.** Update and delete require `Depends(get_current_user)` and verify ownership. The three-way return (`True`/`None`/`False` -> 204/404/403) is consistent across every resource.

**Auth is one function.** Everything flows through `get_current_user()` -> `UserInfo(user_id, email, name, raw_claims)`. Swap JWT for Clerk, Auth0, or SSO by replacing that one dependency. All protected routes keep working.

**Types flow from backend to frontend.** `make types` exports the OpenAPI spec and generates TypeScript types. No manual schema duplication.

## Commands

```bash
make dev             # Postgres + Redis + backend + frontend (hot reload)
make verify          # lint + typecheck + test (both ends) — run before pushing
make test            # just tests
make lint            # ruff (backend) + ESLint (frontend)
make types           # regenerate frontend TypeScript from OpenAPI spec
make migrate         # run Alembic migrations
make migrate-new name="add projects table"  # create a new migration
make seed            # seed DB with sample data
make worker          # start ARQ background task worker
make ui component=button  # add a shadcn/ui component
make persistent      # start OpenClaw background agent (installs if needed)
```

## Deploy

Terraform modules for App Runner, RDS, ECR, and VPC are in `infra/`.

```bash
make deploy-init     # one-time: S3 state bucket + DynamoDB lock table
make deploy          # build, push, terraform apply (defaults to dev)
make deploy env=prod # prod shows plan before applying
```

Standard Docker containers. The AWS modules are a reference — it runs anywhere containers run.

## Adding to an Existing Project

You don't need the template to benefit from SerpentStack. The `serpentstack skills` commands bring project-specific skills and persistent agents to any codebase.

### Install

```bash
npm install -g serpentstack        # requires Node 22+
```

### Step 1: Initialize

```bash
cd your-project
serpentstack skills init
```

This downloads into your project:
- `.skills/generate-skills/SKILL.md` — interviews you to produce project-specific skills
- `.skills/model-routing/SKILL.md` — on-device model delegation for cost savings
- `.skills/find-skills/SKILL.md` — discovering and creating new skills
- `.openclaw/` — persistent agent workspace (SOUL.md, HEARTBEAT.md, AGENTS.md)
- `SKILL-AUTHORING.md` — reference guide for writing skills by hand

### Step 2: Generate project-specific skills

Open your IDE agent (Claude Code, Cursor, Copilot, etc.) and say:

> "Generate skills for my project"

The agent loads `generate-skills/SKILL.md`, reads your codebase, and interviews you about your conventions — transaction patterns, auth, testing, deploy. After 5-8 rounds of questions, it produces a full `.skills/` directory tailored to your codebase.

### Step 3: Start the persistent agent

```bash
serpentstack skills persistent --start
```

This installs [OpenClaw](https://docs.openclaw.ai) if needed and starts a background agent that watches your dev server, catches errors, runs tests, and flags when skills go stale. Customize the behavior by editing:

- **`.openclaw/SOUL.md`** — Agent identity and conventions (update with your project's patterns)
- **`.openclaw/HEARTBEAT.md`** — Check intervals and monitoring targets
- **`.openclaw/AGENTS.md`** — Model routing and cost controls

**Cost note:** Heartbeat checks consume tokens (~4,000-10,000 per cycle). The default config uses Haiku for routine checks and Sonnet for error analysis to keep costs low.

### Keep updated

```bash
serpentstack skills update    # updates base skills + openclaw configs to latest versions
```

### Reference

For writing skills by hand, see **[SKILL-AUTHORING.md](SKILL-AUTHORING.md)**. All skills follow the [Agent Skills open standard](https://agentskills.io/home).

## Design Decisions

| Choice | Why |
|---|---|
| Async SQLAlchemy + asyncpg | AI apps multiplex LLM calls (2-30s each). Async handles thousands of concurrent connections vs ~40 with sync. |
| Testcontainers (real Postgres) | UUID columns, `ON CONFLICT`, JSONB don't exist in SQLite. Real DB in tests catches real bugs. |
| shadcn/ui (zero components installed) | Copies source into your project. `make ui component=X` adds on demand. Delete `components.json` to remove entirely. |
| Domain returns, not exceptions | Services return `None`/`False`, routes translate to HTTP. Services stay reusable in workers, CLI tools, event handlers. |
| `openapi-typescript` | `make types` auto-generates frontend types. No manual schema mirroring. |
| Rate limiting (SlowAPI) | In-memory for dev, Redis for prod. Set `RATE_LIMIT_STORAGE_URI` to switch. |
| Agent Skills open standard | `.skills/` uses the same SKILL.md format as Claude Code, Codex, Cursor, and Copilot. No vendor lock-in. |
| OpenClaw persistent agents | IDE agents are reactive. Persistent agents watch logs, catch errors, run tests proactively. Both read the same skills. |
| CLI: `stack` vs `skills` | `serpentstack stack new` scaffolds the full template. `serpentstack skills init` adds skills + persistent agents to any existing project. Two audiences, one tool. |

## Contributing

Contributions welcome — especially new project-specific skills, Terraform modules for GCP/Azure, and agent config files for additional tools. See [SKILL-AUTHORING.md](SKILL-AUTHORING.md) for how to write good skills. [Open an issue](https://github.com/Benja-Pauls/SerpentStack/issues) for bugs and feature requests.

## License

[MIT](LICENSE)
