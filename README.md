# SerpentStack

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="400" /></p>

<p align="center">
  <a href="https://www.npmjs.com/package/serpentstack"><img src="https://img.shields.io/npm/v/serpentstack?color=blue" alt="npm" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack?label=release&color=blue" alt="Release" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
</p>

<p align="center"><strong>Persistent AI agents that keep your codebase healthy. Skills that make every agent smarter.</strong></p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#persistent-agents">Persistent Agents</a> &middot;
  <a href="#skills">Skills</a> &middot;
  <a href="#production-template">Production Template</a> &middot;
  <a href="#cli-reference">CLI</a>
</p>

---

AI coding agents are only as good as what they know about your project. [Skills](https://agentskills.io/home) — structured knowledge about your conventions, patterns, and architecture — are how [Stripe merges 1,300+ agent-generated PRs per week](https://stripe.dev/blog/how-we-build-software-at-stripe-in-2025) and [Shopify operates with agents as a core part of engineering](https://www.businessinsider.com/shopify-ceo-tells-employees-to-use-ai-before-asking-for-more-staff-2025-4). But skills go stale the moment code changes. Nobody maintains them.

SerpentStack runs **persistent background agents on free local models** that watch your project continuously — catching crashes, running tests, and keeping your skills accurate as code evolves. It also provides a cross-registry skill discovery CLI and a production-ready fullstack template where every convention is pre-encoded as a skill.

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
serpentstack persistent                  # configure and launch background agents
serpentstack notifications               # see what your agents found
```

### New project

```bash
serpentstack stack new my-app
cd my-app
make init && make setup && make dev
```

Running fullstack app at `localhost:8000` (API) and `localhost:5173` (frontend) with JWT auth, resource CRUD, real Postgres tests, and a full AI team pre-configured.

---

## Persistent Agents

Three background agents monitor your project continuously, running on local models via [Ollama](https://ollama.com) at zero cost.

```
.openclaw/
  SOUL.md                     # shared context inherited by all agents
  agents/
    log-watcher/AGENT.md      # dev server health, crash detection     (every 30-60s)
    test-runner/AGENT.md       # test suite, lint, typecheck            (every 5-15min)
    skill-maintainer/AGENT.md  # skill drift detection                  (every 1hr)
```

**Log Watcher** monitors dev server output and catches crashes, import failures, and runtime errors with file paths and fix suggestions.

**Test Runner** runs your test suite, linter, and type checker on a schedule. It tracks which tests are failing, what changed, and whether the test or the source needs updating. It distinguishes new failures from persistent ones.

**Skill Maintainer** compares `.skills/` files against actual code patterns and proposes updates when conventions drift. This is the critical piece — without it, skills go stale and agents start producing code that doesn't match your project. No other tool does this.

Agents write findings to `~/.serpentstack/notifications/`. Read them with:

```bash
serpentstack notifications               # list all findings
serpentstack notifications --errors      # errors only
serpentstack notifications --read 1      # full detail on a specific finding
serpentstack notifications --clear       # clear all
```

During setup, SerpentStack installs Ollama and downloads a model if needed — no API keys or configuration required. Cloud models are available for users who prefer them.

```bash
serpentstack persistent                  # guided setup on first run, status dashboard after
serpentstack persistent --start          # launch agents
serpentstack persistent --stop           # stop all agents
serpentstack persistent --agents         # change models or enable/disable
```

To add your own agent, create a folder under `.openclaw/agents/` with an `AGENT.md` file.

---

## Skills

SerpentStack ships 10 base skills and a CLI for finding community skills across every major registry.

### Base skills

| Skill | What it teaches agents |
|---|---|
| `scaffold` | End-to-end resource generation: model, schema, service, route, migration, tests, frontend types |
| `auth` | JWT, ownership enforcement, SSO swap patterns (one function to replace) |
| `test` | Real Postgres via testcontainers, savepoint isolation, async httpx |
| `db-migrate` | Alembic workflow: create, review, apply, troubleshoot, rollback |
| `deploy` | Docker multi-stage builds, ECR push, Terraform plan/apply, rollback |
| `dev-server` | Error detection patterns for FastAPI and Vite/React |
| `git-workflow` | Branch naming, conventional commits, PR checklists |
| `model-routing` | Delegate code generation to local models for 10-50x cost reduction |
| `generate-skills` | Interview-based generation of project-specific skills for any codebase |
| `find-skills` | Evaluate and adopt community skills safely |

Each skill contains complete, copy-paste templates with real imports and type signatures — not descriptions of what code should look like. Every skill ends with a verification step so agents can confirm their own work.

These follow the [Agent Skills open standard](https://agentskills.io/home) and work with Claude Code, Codex, Cursor, Copilot, Gemini CLI, and any tool that reads `SKILL.md` files.

### Generating skills for your project

The most valuable skill is `generate-skills`. Ask your IDE agent to read `.skills/generate-skills/SKILL.md` — it will analyze your codebase, interview you about your architecture decisions, and produce a custom skill set tailored to your project. This is the fastest path to agents that understand your conventions.

### Skill discovery

```bash
serpentstack search "auth oauth"         # cross-registry search
serpentstack discover                    # project-aware recommendations
serpentstack add clerk                   # install by name (resolves via registries)
serpentstack add stripe/ai               # install from a specific GitHub repo
```

Sources: [Anthropic official skills](https://github.com/anthropics/skills), [skills.sh](https://skills.sh/), [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills), and public GitHub repos.

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

**Backend:** FastAPI with async SQLAlchemy and asyncpg. Async handles thousands of concurrent LLM-multiplexed connections where sync tops out around 40.

**Frontend:** React with TypeScript. Types generated from the backend's OpenAPI spec via `make types` — no manual schema duplication.

**Testing:** pytest with testcontainers running real Postgres. SQLite can't reproduce UUID columns, `ON CONFLICT`, or JSONB behavior.

**Infrastructure:** Terraform modules for AWS App Runner, RDS, ECR, and VPC. Standard Docker containers — runs anywhere containers run.

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
# Agents
serpentstack persistent                 # status dashboard (guided setup on first run)
serpentstack persistent --start         # launch agents
serpentstack persistent --stop          # stop all agents
serpentstack notifications              # what your agents found
serpentstack notifications --errors     # errors only
serpentstack notifications --read 1     # full detail

# Skills
serpentstack skills                     # download base skills and agent configs
serpentstack skills update              # update to latest versions

# Discovery
serpentstack search <query>             # search skill registries
serpentstack discover                   # analyze project and recommend skills
serpentstack add <source>               # install from any registry or repo

# Template
serpentstack stack new <name>           # scaffold a new project
serpentstack stack update               # update template files
```

---

## Contributing

Contributions are welcome. Areas of particular interest: new skills for common frameworks, persistent agent configs for new use cases, background agent improvements, Terraform modules for GCP and Azure, and integrations with other AI coding tools.

See [SKILL-AUTHORING.md](SKILL-AUTHORING.md) for the skill format. [Open an issue](https://github.com/Benja-Pauls/SerpentStack/issues) for bugs and feature requests.

## License

[MIT](LICENSE)
