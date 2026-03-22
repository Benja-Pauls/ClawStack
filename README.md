# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="https://www.npmjs.com/package/serpentstack"><img src="https://img.shields.io/npm/v/serpentstack?color=blue" alt="npm" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack?label=release&color=blue" alt="Release" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
</p>

<p align="center">
  <strong>The open-source AI team framework.</strong><br>
  <em>IDE agents that know your codebase. Background agents that never stop working.</em>
</p>

<p align="center">
  <a href="#existing-project">Existing Project</a> &nbsp;&middot;&nbsp;
  <a href="#new-project">New Project</a> &nbsp;&middot;&nbsp;
  <a href="#the-ai-team">The AI Team</a> &nbsp;&middot;&nbsp;
  <a href="#what-gets-installed">What Gets Installed</a> &nbsp;&middot;&nbsp;
  <a href="#cli-reference">CLI Reference</a> &nbsp;&middot;&nbsp;
  <a href="#template-reference">Template Reference</a>
</p>

---

Your IDE agent writes code when you ask. But who catches the error at 2am? Who notices the test that started failing three commits ago? Who flags that your skills drifted from the actual codebase?

**An AI team does.**

SerpentStack is the open-source framework for building AI development teams — not just a single agent you talk to, but a coordinated group of specialists that work alongside you. IDE agents that understand your project's exact conventions. Background agents that watch, test, and maintain your codebase around the clock. All running on local models by default, so it costs nothing.

```bash
npm install -g serpentstack    # requires Node 22+
```

---

## Existing Project

Add an AI team to any codebase in three steps.

### 1. Initialize

```bash
cd your-project
serpentstack skills
```

Downloads skills, persistent agent configs, and auto-detects your project settings. If your project has a `package.json`, `Makefile`, `pyproject.toml`, or similar, SerpentStack will pre-fill your language, framework, dev commands, and conventions automatically. See [What Gets Installed](#what-gets-installed) for the full list.

### 2. Generate project-specific skills

Open your IDE agent (Claude Code, Cursor, Copilot, Gemini CLI, etc.) and paste this prompt:

> Read `.skills/generate-skills/SKILL.md` and follow its instructions to generate project-specific skills for this codebase. Interview me about my architecture decisions — how I handle transactions, auth, error patterns, testing strategy, and deployment. Ask about the business domain too: what this app does, key user flows, and where agents are most likely to make mistakes. Write each skill as a `SKILL.md` with complete templates an agent can copy, not vague descriptions. Reference `SKILL-AUTHORING.md` for the format.

The agent reads your codebase, asks 5-8 rounds of questions about your conventions, and produces a full `.skills/` directory tailored to your project.

### 3. Start your AI team

```bash
serpentstack persistent
```

Walks you through a guided setup:
1. **Project config** — confirms your project name, language, framework, and commands (auto-detected defaults, just hit Enter)
2. **System assessment** — checks your RAM and recommends model sizes
3. **Agent selection** — shows what each agent does, lets you enable/disable and pick models
4. **Model install** — if you pick a local model and Ollama isn't installed, SerpentStack installs it for you and downloads the model automatically
5. **Launch** — registers agents with [OpenClaw](https://docs.openclaw.ai), starts the gateway, and your team begins working

Your choices are saved to `.openclaw/config.json`. Subsequent runs show a status dashboard.

### Keep updated

```bash
serpentstack skills update    # updates base skills + configs to latest versions
```

---

## New Project

Scaffold a production-ready fullstack app with a full AI team already configured.

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

## The AI Team

Most AI coding tools give you one agent that helps when you ask. SerpentStack gives you a team that works when you don't.

### Two layers, one standard

| | IDE Agents (your pair programmer) | Background Agents (your team) |
|---|---|---|
| **What they do** | Write code when you ask, following your project's specific patterns | Watch, test, and maintain your codebase continuously |
| **Standard** | [Agent Skills](https://agentskills.io/home) (`SKILL.md`) | [OpenClaw](https://docs.openclaw.ai) (`AGENT.md`) |
| **Tools** | Claude Code, Codex, Cursor, Copilot, Gemini CLI | OpenClaw gateway with scheduled tasks |
| **Directory** | `.skills/` | `.openclaw/agents/` |
| **Models** | Whatever your IDE uses | Local by default (free via Ollama), cloud optional |

Both are plain text. Both are version-controlled. Neither requires vendor lock-in.

### The default team

```
.openclaw/
  SOUL.md                              # shared project identity all agents inherit
  config.json                          # project settings + per-agent model config
  agents/
    log-watcher/AGENT.md               # watches dev server, scans logs (every 30-60s)
    test-runner/AGENT.md               # runs tests, lint, typecheck (every 5-15min)
    skill-maintainer/AGENT.md          # detects stale skills (every 1hr)
```

**Log Watcher** — Monitors your dev server health and log output every 30-60 seconds. Catches backend crashes, frontend build errors, and import failures. Reports them with file paths and suggested fixes before you even notice something is wrong.

**Test Runner** — Runs your test suite every 5 minutes and lint/typecheck every 15 minutes. Catches regressions before you commit. Shows which test failed, what changed, and whether the test or the source needs fixing.

**Skill Maintainer** — Checks every hour whether your `.skills/` files still match the actual codebase. When code patterns drift from what skills describe, it proposes exact updates so every IDE agent stays accurate.

### Local-first, zero cost by default

Persistent agents default to local models via [Ollama](https://ollama.com). SerpentStack auto-installs Ollama and downloads models for you during setup — no API keys, no token costs, no cloud dependency. The CLI shows your system's RAM and recommends model sizes that fit.

Cloud models (via OpenClaw API keys) are available as an option for users who want them, with clear warnings about per-heartbeat token costs.

### Build your own team

Add an agent by creating `.openclaw/agents/<name>/AGENT.md` with YAML frontmatter:

```yaml
---
name: deploy-watcher
description: Monitors deployment health after every push
model: ollama/llama3.2
schedule:
  - every: 5m
    task: check-deployment-health
tools:
  - file-system
  - shell
---

# Deploy Watcher Agent

Your instructions here...
```

Remove an agent by deleting its folder. Each agent gets its own model, schedule, and instructions.

---

## What Gets Installed

### `serpentstack skills` downloads:

| File | What it does |
|---|---|
| `.skills/auth/SKILL.md` | Auth patterns — `get_current_user`, JWT, ownership enforcement, SSO swap |
| `.skills/db-migrate/SKILL.md` | Alembic workflow — create, review, apply, rollback, seed data |
| `.skills/deploy/SKILL.md` | Docker build, ECR push, Terraform plan/apply, health checks, rollback |
| `.skills/dev-server/SKILL.md` | Error detection patterns for backend (structured JSON) and frontend (Vite/React) |
| `.skills/find-skills/SKILL.md` | Discover community skills, evaluate them, create new project-specific ones |
| `.skills/generate-skills/SKILL.md` | Interviews you and produces a full `.skills/` directory tailored to your project |
| `.skills/git-workflow/SKILL.md` | Branch naming, conventional commits, PR format, pre-push checklist |
| `.skills/model-routing/SKILL.md` | Delegate to on-device models (Ollama) for cost reduction |
| `.skills/scaffold/SKILL.md` | Full end-to-end resource generation — model through frontend |
| `.skills/test/SKILL.md` | Real Postgres via testcontainers, savepoint-rollback isolation |
| `.openclaw/SOUL.md` | Shared project identity — all agents inherit this |
| `.openclaw/agents/*/AGENT.md` | Three background agents (log-watcher, test-runner, skill-maintainer) |
| `.openclaw/config.json` | Project settings + per-agent model config (auto-detected defaults) |
| `SKILL-AUTHORING.md` | Reference guide for writing project-specific skills by hand |

All skills use the [Agent Skills open standard](https://agentskills.io/home) — the same `SKILL.md` format supported by Claude Code, Codex, Cursor, Copilot, Gemini CLI, and others.

### Why these skills work

- **Complete templates, not descriptions.** Skills contain the actual files an agent should produce — real imports, real type signatures, real test assertions. The agent doesn't need to infer anything.
- **The full chain, not just parts.** Each resource covers model → schema → service → route → migration → tests → frontend types → API client → hooks → page.
- **Verification built in.** Every skill ends with how to check the work: `make verify`, specific test commands, expected outputs.
- **Composable.** Skills reference each other — scaffold points to auth for ownership details, test points to scaffold for service return patterns.

---

## CLI Reference

```bash
# Install
npm install -g serpentstack              # requires Node 22+

# New projects
serpentstack stack new <name>            # scaffold a full project from the template
serpentstack stack update                # update template-level files to latest

# Any project
serpentstack skills                      # download all skills + persistent agent configs
serpentstack skills update               # update base skills to latest versions
serpentstack persistent                  # status dashboard (first run = full guided setup)
serpentstack persistent --configure      # edit project settings
serpentstack persistent --agents         # change agent models, enable/disable
serpentstack persistent --models         # list installed & recommended models
serpentstack persistent --start          # launch enabled agents
serpentstack persistent --stop           # stop all running agents

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
.openclaw/         # Background agent workspace (OpenClaw)
```

### Patterns

These are the conventions encoded in `.skills/`. An agent learns them on first read.

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

Contributions welcome — especially new project-specific skills, background agent configs (`.openclaw/agents/<name>/AGENT.md`), Terraform modules for GCP/Azure, and integrations with other AI coding tools. See [SKILL-AUTHORING.md](SKILL-AUTHORING.md) for how to write good skills. [Open an issue](https://github.com/Benja-Pauls/SerpentStack/issues) for bugs and feature requests.

## License

[MIT](LICENSE)
