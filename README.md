# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="https://www.npmjs.com/package/serpentstack"><img src="https://img.shields.io/npm/v/serpentstack?color=blue" alt="npm" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack?label=release&color=blue" alt="Release" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
</p>

<p align="center"><strong>The open-source AI team framework.</strong></p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#skill-discovery">Skill Discovery</a> &middot;
  <a href="#persistent-agents">Persistent Agents</a> &middot;
  <a href="#production-template">Production Template</a> &middot;
  <a href="#cli-reference">CLI</a>
</p>

---

AI coding agents are only as good as what they know about your project. The difference between an agent that produces five rounds of corrections and one that gets it right the first time comes down to [skills](https://agentskills.io/home) — structured knowledge about your conventions, patterns, and architecture. This is how Stripe merges [1,300+ agent-generated PRs per week](https://stripe.dev/blog/how-we-build-software-at-stripe-in-2025) and Shopify operates with agents as [a core part of their engineering workflow](https://www.businessinsider.com/shopify-ceo-tells-employees-to-use-ai-before-asking-for-more-staff-2025-4). Teams that invest in high-quality skills and continuous agent feedback ship faster, regardless of which model or IDE they use.

SerpentStack is a CLI and framework built around that idea. It solves three problems:

1. **Finding skills is fragmented.** There are half a million [agent skills](https://agentskills.io/home) spread across Anthropic, Vercel, GitHub, and dozens of community repos. SerpentStack searches all of them from one command and recommends skills based on your project's actual stack.

2. **Agents need continuous feedback.** A coding agent that only runs when you ask it to will miss regressions, crashes, and stale documentation. SerpentStack runs persistent background agents on free local models via [Ollama](https://ollama.com) — no API keys, no cloud costs.

3. **Starting from scratch is slow.** SerpentStack includes a production-ready fullstack template (FastAPI, React, Postgres, Terraform) with working auth, CRUD, tests, and deployment. Every convention is encoded as a skill that agents can read on first interaction.

```bash
npm install -g serpentstack
```

Requires Node 22+.

---

## Quick Start

### Existing project

```bash
cd your-project
serpentstack skills                      # download base skills + agent configs
serpentstack search "react testing"      # find community skills for your stack
serpentstack persistent                  # configure and launch background agents
```

SerpentStack reads your `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or `Makefile` to detect language, framework, and dev commands automatically.

### New project

```bash
serpentstack stack new my-app
cd my-app
make init && make setup && make dev
```

This gives you a running fullstack app at `localhost:8000` (API) and `localhost:5173` (frontend) with JWT auth, resource CRUD, ownership enforcement, real Postgres tests, and a full AI team pre-configured. See [Production Template](#production-template) for details.

---

## Skill Discovery

Skills — markdown files that teach agents your project's conventions — are the highest-leverage investment a team can make in AI-assisted development. The problem is finding good ones. SerpentStack indexes the major registries and community collections so you don't have to browse them individually.

```bash
serpentstack search "auth oauth"         # cross-registry search
serpentstack discover                    # project-aware recommendations
serpentstack add stripe/agent-skills     # install from any GitHub repo or registry
```

Sources include [Anthropic's official skills](https://github.com/anthropics/skills), [Vercel's skills.sh](https://skills.sh/), [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills), [SkillsMP](https://skillsmp.com), and public GitHub repos with skill files.

SerpentStack also runs as an **MCP server** (`serpentstack mcp`), which means your agents can search for and install skills without your involvement.

### Base skills

SerpentStack ships 10 skills as a starting point:

| Skill | Purpose |
|---|---|
| `auth` | JWT, ownership enforcement, SSO swap patterns |
| `db-migrate` | Alembic migrations — create, review, apply, rollback |
| `deploy` | Docker, ECR, Terraform plan/apply, rollback procedures |
| `dev-server` | Error detection patterns for backend and frontend servers |
| `find-skills` | Evaluate and adopt community skills |
| `generate-skills` | Interview-based generation of project-specific skills |
| `git-workflow` | Branch naming, conventional commits, PR checklists |
| `model-routing` | Delegate tasks to local models for cost reduction |
| `scaffold` | End-to-end resource generation, model through frontend |
| `test` | Real Postgres via testcontainers, savepoint isolation |

These follow the [Agent Skills open standard](https://agentskills.io/home) and work with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any tool that reads `SKILL.md` files.

Each skill contains complete, copy-paste templates with real imports and type signatures — not descriptions of what code should look like. Every skill ends with a verification step so agents can confirm their own work.

To generate skills tailored to your project, ask your IDE agent to read `.skills/generate-skills/SKILL.md`. It will interview you about your architecture decisions and produce a custom skill set.

---

## Persistent Agents

SerpentStack includes three background agents that monitor your project continuously, running on local models at zero cost.

```
.openclaw/
  SOUL.md                     # shared context inherited by all agents
  agents/
    log-watcher/AGENT.md      # dev server health, crash detection     (every 30-60s)
    test-runner/AGENT.md       # test suite, lint, typecheck            (every 5-15min)
    skill-maintainer/AGENT.md  # skill drift detection                  (every 1hr)
```

**Log Watcher** monitors dev server output and catches backend crashes, frontend build errors, and import failures with file paths and fix suggestions.

**Test Runner** runs your test suite, linter, and type checker on a schedule. It reports which test failed, what changed, and whether the test or the source needs updating.

**Skill Maintainer** compares `.skills/` files against actual code patterns and proposes updates when they drift. This keeps every IDE agent working from accurate information.

Agents default to local models via [Ollama](https://ollama.com). During setup, SerpentStack installs Ollama and downloads a model if needed — no configuration required. Cloud models are available for users who prefer them.

```bash
serpentstack persistent                  # guided setup on first run, status dashboard after
serpentstack persistent --start          # launch agents
serpentstack persistent --stop           # stop all agents and the gateway
serpentstack persistent --agents         # change models or enable/disable agents
serpentstack persistent --models         # browse installed and available models
```

To add your own agent, create a folder under `.openclaw/agents/` with an `AGENT.md` file:

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
```

---

## Production Template

Projects created with `serpentstack stack new` include a complete fullstack application. This is not a starter template with TODO comments — it ships with working authentication, resource CRUD, ownership enforcement, database migrations, and infrastructure-as-code.

**Prerequisites:** Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/)

<details>
<summary><strong>Architecture</strong></summary>

```
backend/
  app/routes/         # API handlers — delegate to services
  app/services/       # Business logic — async, returns domain objects
  app/models/         # SQLAlchemy ORM with UUID primary keys
  app/schemas/        # Pydantic request/response models
  tests/              # pytest + testcontainers (real Postgres)
  migrations/         # Alembic

frontend/src/
  routes/             # Page components
  api/client.ts       # Fetch wrapper with auth token injection
  contexts/           # AuthContext + useAuth hook
  types/              # Auto-generated from OpenAPI

infra/                # Terraform: App Runner, RDS, ECR, VPC
.skills/              # Agent skills (open standard)
.openclaw/            # Persistent agent workspace
```

**Backend:** FastAPI with async SQLAlchemy and asyncpg. Chosen because AI applications multiplex LLM calls (2-30 seconds each), and async handles thousands of concurrent connections where sync tops out around 40.

**Frontend:** React with TypeScript. Types are generated from the backend's OpenAPI spec via `make types` — no manual schema duplication.

**Testing:** pytest with testcontainers running real Postgres. SQLite can't reproduce UUID columns, `ON CONFLICT`, or JSONB behavior, so tests run against the same database engine as production.

**Infrastructure:** Terraform modules for AWS App Runner, RDS, ECR, and VPC. Standard Docker containers — the AWS modules are a reference implementation that runs anywhere containers run.

</details>

<details>
<summary><strong>Conventions</strong></summary>

These patterns are encoded in `.skills/` so agents learn them on first read.

**Services flush, routes commit.** Services call `db.flush()` but never `db.commit()`. The route handler owns the transaction boundary, allowing multiple service calls to compose atomically.

**Services return domain objects, not HTTP errors.** A service returns `None` for not-found, `False` for forbidden, or a domain object for success. Routes translate these to HTTP status codes. This keeps services reusable in background workers, CLI tools, and event handlers.

**Auth is one function.** All protected routes depend on `get_current_user()`, which returns a `UserInfo` object. Swapping JWT for Clerk, Auth0, or any SSO provider means replacing that one dependency.

**Types flow from backend to frontend.** `make types` exports the OpenAPI spec and generates TypeScript interfaces. The frontend never contains hand-written API types.

</details>

<details>
<summary><strong>Commands</strong></summary>

```bash
make dev             # Postgres + Redis + backend + frontend with hot reload
make verify          # lint + typecheck + test (both stacks)
make test            # tests only
make types           # regenerate frontend TypeScript from OpenAPI
make migrate         # run Alembic migrations
make deploy          # build, push, terraform apply
```

</details>

---

## CLI Reference

```bash
# Discovery
serpentstack search <query>             # search skill registries
serpentstack discover                   # analyze project and recommend skills
serpentstack add <source>               # install from any registry or repo
serpentstack mcp                        # run as MCP server

# Skills
serpentstack skills                     # download base skills and agent configs
serpentstack skills update              # update to latest versions

# Agents
serpentstack persistent                 # status dashboard (guided setup on first run)
serpentstack persistent --configure     # edit project settings
serpentstack persistent --agents        # configure agent models
serpentstack persistent --models        # list and install models
serpentstack persistent --start         # launch agents
serpentstack persistent --stop          # stop all agents

# Template
serpentstack stack new <name>           # scaffold a new project
serpentstack stack update               # update template files
```

---

## Contributing

Contributions are welcome. Areas of particular interest: new skills for common frameworks, connectors for additional skill registries, background agent configs, Terraform modules for GCP and Azure, and integrations with other AI coding tools.

See [SKILL-AUTHORING.md](SKILL-AUTHORING.md) for the skill format. [Open an issue](https://github.com/Benja-Pauls/SerpentStack/issues) for bugs and feature requests.

## License

[MIT](LICENSE)
