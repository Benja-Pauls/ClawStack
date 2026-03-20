# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="https://www.npmjs.com/package/serpentstack"><img src="https://img.shields.io/npm/v/serpentstack?color=blue" alt="npm" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack?label=release&color=blue" alt="Release" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
</p>

<p align="center">
  <a href="#existing-project">Existing Project</a> &nbsp;&middot;&nbsp;
  <a href="#new-project">New Project</a> &nbsp;&middot;&nbsp;
  <a href="#what-gets-installed">What Gets Installed</a> &nbsp;&middot;&nbsp;
  <a href="#persistent-agents">Persistent Agents</a> &nbsp;&middot;&nbsp;
  <a href="#cli-reference">CLI Reference</a> &nbsp;&middot;&nbsp;
  <a href="#template-reference">Template Reference</a>
</p>

---

Generic skills teach agents how to code. Project-specific skills teach agents how to code **like your team does** — your transaction patterns, your auth conventions, your ownership enforcement, your test infrastructure. There are thousands of generic skills in [marketplaces](https://github.com/anthropics/skills). None of them know your codebase.

SerpentStack is the open-source standard for AI-driven development. It gives your IDE agents project-specific skills so they write code matching your conventions, and configures persistent background agents ([OpenClaw](https://docs.openclaw.ai)) that continuously watch your dev server, catch errors, run tests, and maintain those skills as your project evolves.

```bash
npm install -g serpentstack    # requires Node 22+
```

---

## Existing Project

Add AI-driven development standards to any codebase in three steps.

### 1. Initialize

```bash
cd your-project
serpentstack skills
```

This downloads base skills, persistent agent configs, and a skill-authoring guide into your project. See [What Gets Installed](#what-gets-installed) for the full list.

### 2. Generate project-specific skills

Open your IDE agent (Claude Code, Cursor, Copilot, etc.) and paste this prompt:

> Read `.skills/generate-skills/SKILL.md` and follow its instructions to generate project-specific skills for this codebase. Interview me about my architecture decisions — how I handle transactions, auth, error patterns, testing strategy, and deployment. Ask about the business domain too: what this app does, key user flows, and where agents are most likely to make mistakes. Write each skill as a `SKILL.md` with complete templates an agent can copy, not vague descriptions. Reference `SKILL-AUTHORING.md` for the format.

The agent reads your codebase, asks 5-8 rounds of questions about your conventions, and produces a full `.skills/` directory tailored to your project.

### 3. Start persistent agents

```bash
serpentstack persistent                   # configure + select agents + launch
```

Walks you through configuring your project, lets you choose which agents to enable and what model each uses (cloud or local), then opens each agent in its own terminal window. They watch your dev server, catch errors before you see them, run tests on a schedule, and flag when skills go stale. Your choices are saved to `.openclaw/config.json` so re-runs skip the questions. See [Persistent Agents](#persistent-agents) for details.

### Keep updated

```bash
serpentstack skills update    # updates base skills + configs to latest versions
```

---

## New Project

Scaffold a production-ready fullstack app with skills and persistent agent configs already written.

```bash
serpentstack stack new my-app
cd my-app
make init      # interactive setup — project name, DB config
make setup     # install dependencies (Python via uv, Node via npm)
make dev       # start Postgres + Redis + backend + frontend with hot reload
```

**Prerequisites:** Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/).

Backend at `localhost:8000`, frontend at `localhost:5173`. Working Items CRUD, JWT auth (register/login), and ownership enforcement out of the box.

Try this prompt to verify the skills are working:

> Read `.skills/scaffold/SKILL.md` and add a Projects resource with full CRUD, JWT auth, and ownership enforcement. Follow the service/route/test/frontend patterns exactly as the skill describes. Run `make verify` when done to confirm everything passes.

See [Template Reference](#template-reference) for the full stack details, patterns, and dev commands.

---

## What Gets Installed

### `serpentstack skills` downloads:

| File | What it does |
|---|---|
| `.skills/generate-skills/SKILL.md` | Interviews you about your codebase conventions and produces a full `.skills/` directory tailored to your project |
| `.skills/model-routing/SKILL.md` | Delegate code generation to on-device models (Ollama) while keeping cloud models for orchestration — 10-50x cost reduction |
| `.skills/find-skills/SKILL.md` | How to discover community skills, evaluate them, create new project-specific ones |
| `.skills/git-workflow/SKILL.md` | Branch naming, conventional commits, PR format, pre-push checklist |
| `.openclaw/SOUL.md` | Shared project identity — architecture, conventions, and patterns all agents inherit |
| `.openclaw/agents/log-watcher/AGENT.md` | Watches dev server health and scans logs for errors (Haiku, every 30-60s) |
| `.openclaw/agents/test-runner/AGENT.md` | Runs tests on schedule, catches regressions (Haiku, every 5-15min) |
| `.openclaw/agents/skill-maintainer/AGENT.md` | Detects stale skills and proposes updates (Sonnet, every 1hr) |
| `SKILL-AUTHORING.md` | Reference guide for writing project-specific skills by hand |

### `serpentstack stack new` includes everything above, plus:

| File | What it does |
|---|---|
| `scaffold/SKILL.md` | Full end-to-end resource generation — model, schema, service (flush-only, domain returns), route (commit + ownership), tests (testcontainers), frontend (typed API client + hooks) |
| `auth/SKILL.md` | The `UserInfo` contract, `get_current_user` dependency, how to protect routes, how to swap JWT for Clerk/Auth0/SSO |
| `test/SKILL.md` | Real Postgres via testcontainers, savepoint-rollback isolation, `asyncio_mode = "auto"` |
| `db-migrate/SKILL.md` | Alembic workflow — create, review, apply, rollback, seed data |
| `dev-server/SKILL.md` | Error detection patterns for backend (structured JSON logs) and frontend (Vite/React) |
| `deploy/SKILL.md` | Docker build, ECR push, Terraform plan/apply, health check verification, rollback |

All skills use the [Agent Skills open standard](https://agentskills.io/home) — the same `SKILL.md` format supported by Claude Code, Codex, Cursor, Copilot, Gemini CLI, and others.

### Why these skills work

- **Complete templates, not descriptions.** Skills contain the actual files an agent should produce — real imports, real type signatures, real test assertions. The agent doesn't need to infer anything.
- **The full chain, not just parts.** Each resource covers model → schema → service → route → migration → tests → frontend types → API client → hooks → page.
- **Verification built in.** Every skill ends with how to check the work: `make verify`, specific test commands, expected outputs.
- **Composable.** Skills reference each other — scaffold points to auth for ownership details, test points to scaffold for service return patterns.

---

## Persistent Agents

IDE agents help when you ask. Persistent agents help before you ask — watching your dev server, catching errors in real time, running tests on a schedule, and flagging when skills go stale because your code changed.

SerpentStack ships with a multi-agent [OpenClaw](https://docs.openclaw.ai) workspace in `.openclaw/`:

```
.openclaw/
  SOUL.md                              # shared project identity (all agents inherit)
  agents/
    log-watcher/AGENT.md               # watches dev server, scans logs (Haiku, 30-60s)
    test-runner/AGENT.md               # runs tests, lint, typecheck (Haiku, 5-15min)
    skill-maintainer/AGENT.md          # detects stale skills (Sonnet, 1hr)
```

Each `AGENT.md` is a self-contained agent definition with YAML frontmatter (model, schedule, tools) and markdown instructions. `serpentstack persistent` discovers all agents, lets you choose which to start and what model each uses, then opens each in its own terminal window as a separate OpenClaw process.

| | IDE / Sidecar Agents | Persistent Agents |
|---|---|---|
| **Standard** | [Agent Skills](https://agentskills.io/home) (SKILL.md) | [OpenClaw](https://docs.openclaw.ai) (AGENT.md per agent) |
| **Agents** | Claude Code, Codex, Cursor, Copilot, Gemini CLI | OpenClaw gateway (one per agent) |
| **Mode** | On-demand: you ask, it acts | Always-on: they watch, they tell you |
| **Directory** | `.skills/` | `.openclaw/agents/` |

Both are plain text. Both are version-controlled. Neither requires vendor lock-in.

**Managing agents:** Add an agent by creating `.openclaw/agents/<name>/AGENT.md`. Remove one by deleting its folder. Each agent gets its own model and schedule — Haiku for routine checks, Sonnet for deep analysis.

**Cost note:** Heartbeat checks consume tokens (~4,000-10,000 per cycle). The defaults use Haiku for routine checks and Sonnet only for skill analysis to keep costs low.

---

## CLI Reference

```bash
# Install
npm install -g serpentstack              # requires Node 22+

# New projects
serpentstack stack new <name>            # scaffold a full project from the template
serpentstack stack update                # update template-level files to latest

# Any project
serpentstack skills                      # download base skills + persistent agent configs
serpentstack skills update               # update base skills to latest versions
serpentstack persistent                  # manage + launch persistent agents
serpentstack persistent --stop           # stop all running agents
serpentstack persistent --reconfigure    # change models, enable/disable agents

# Options
--force                                 # overwrite existing files
--all                                   # include new files in updates (skills update)
```

---

<details>
<summary><h2>Template Reference</h2></summary>

Details for developers working inside a project created with `serpentstack stack new`.

### Project Structure

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

### Patterns

These are the conventions encoded in `.skills/` and `.cursorrules`. An agent learns them on first read.

**Services flush, routes commit.** Services call `await db.flush()` but never `db.commit()`. The route handler owns the transaction boundary. This lets you compose multiple service calls atomically.

**Services never raise HTTPException.** They return `None` for not-found, `False` for not-yours, or a domain object for success. Routes translate: `None` → 404, `False` → 403, object → 200.

**Ownership enforcement.** Update and delete require `Depends(get_current_user)` and verify ownership. The three-way return (`True`/`None`/`False` → 204/404/403) is consistent across every resource.

**Auth is one function.** Everything flows through `get_current_user()` → `UserInfo(user_id, email, name, raw_claims)`. Swap JWT for Clerk, Auth0, or SSO by replacing that one dependency. All protected routes keep working.

**Types flow from backend to frontend.** `make types` exports the OpenAPI spec and generates TypeScript types. No manual schema duplication.

### Dev Commands

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
```

### Deploy

Terraform modules for App Runner, RDS, ECR, and VPC are in `infra/`.

```bash
make deploy-init     # one-time: S3 state bucket + DynamoDB lock table
make deploy          # build, push, terraform apply (defaults to dev)
make deploy env=prod # prod shows plan before applying
```

Standard Docker containers. The AWS modules are a reference — it runs anywhere containers run.

### Design Decisions

| Choice | Why |
|---|---|
| Async SQLAlchemy + asyncpg | AI apps multiplex LLM calls (2-30s each). Async handles thousands of concurrent connections vs ~40 with sync. |
| Testcontainers (real Postgres) | UUID columns, `ON CONFLICT`, JSONB don't exist in SQLite. Real DB in tests catches real bugs. |
| shadcn/ui (zero components installed) | Copies source into your project. `make ui component=X` adds on demand. Delete `components.json` to remove entirely. |
| Domain returns, not exceptions | Services return `None`/`False`, routes translate to HTTP. Services stay reusable in workers, CLI tools, event handlers. |
| `openapi-typescript` | `make types` auto-generates frontend types. No manual schema mirroring. |
| Rate limiting (SlowAPI) | In-memory for dev, Redis for prod. Set `RATE_LIMIT_STORAGE_URI` to switch. |

</details>

## Contributing

Contributions welcome — especially new project-specific skills, persistent agent configs (`.openclaw/agents/<name>/AGENT.md`), and Terraform modules for GCP/Azure. See [SKILL-AUTHORING.md](SKILL-AUTHORING.md) for how to write good skills. [Open an issue](https://github.com/Benja-Pauls/SerpentStack/issues) for bugs and feature requests.

## License

[MIT](LICENSE)
