# 🦞 ClawStack - Fullstack AI-Agent-Assisted Development Template

<p align="center"><img src="assets/clawstack-logo.png" alt="ClawStack" width="600" /></p>

<p align="center">
  <strong>The first fullstack template designed for AI-agent-assisted development.</strong><br/>
  FastAPI + React + Postgres + Terraform, pre-wired with context files and agent skills so your agent understands your project from the first commit.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/Benja-Pauls/ClawStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/ClawStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/Benja-Pauls/ClawStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/ClawStack" alt="Release" /></a>
  <img src="https://img.shields.io/badge/OpenClaw_%7C_NemoClaw-compatible-7c3aed" alt="OpenClaw | NemoClaw compatible" />
  <a href="https://github.com/Benja-Pauls/ClawStack/stargazers"><img src="https://img.shields.io/github/stars/Benja-Pauls/ClawStack?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="#tier-1">Tier 1: Quick Start</a> ·
  <a href="#tier-2">Tier 2: OpenClaw</a> ·
  <a href="#tier-3">Tier 3: NemoClaw</a> ·
  <a href="#deploy-to-aws">Deploy to AWS</a> ·
  <a href="docs/tutorial.md">Tutorial</a> ·
  <a href="#skills">Skills</a> ·
  <a href="#configuration">Config</a> ·
  <a href="docs/faq.md">FAQ</a>
</p>

---

## Why ClawStack?

Every AI coding session starts cold. The agent doesn't know your project structure, your conventions, or why you're using Alembic instead of raw SQL. It hallucinates paths and scaffolds patterns that don't fit.

ClawStack ships with SKILL.md context files your agent reads immediately, structured JSON logging it can parse programmatically, and automation skills for dev server watching, endpoint scaffolding, and one-command AWS deploys. The skills are plain markdown — any agent can follow them. OpenClaw makes them persistent and automatic.

See [Customize ↓](#customize) for how to make this fit with your own stack.

### The Stack

<table>
<tr>
<td width="160"><img src="https://img.shields.io/badge/Frontend-61DAFB?style=for-the-badge&logoColor=black" /></td>
<td><strong>React 18 · TypeScript · Vite 6 · Tailwind v4</strong><br/>TanStack Query for data fetching · React Router v6 · Vitest</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Backend-22C55E?style=for-the-badge&logoColor=white" /></td>
<td><strong>FastAPI · Python 3.12 · uv · async SQLAlchemy</strong><br/>Pydantic settings · structured JSON logging · rate limiting · typed schemas</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Database-336791?style=for-the-badge&logoColor=white" /></td>
<td><strong>PostgreSQL · SQLAlchemy 2.0 (async) · Alembic</strong><br/>asyncpg driver · Docker locally · RDS in AWS · migrations via Alembic</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Infra-FF9900?style=for-the-badge&logoColor=white" /></td>
<td><strong>Terraform · AWS App Runner · ECR · RDS</strong><br/>VPC networking included · dev / staging / prod environments</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/CI-24292E?style=for-the-badge&logoColor=white" /></td>
<td><strong>GitHub Actions · pytest + testcontainers · Vitest</strong><br/>Tests against real Postgres · lint on every push · CD pipeline deploys on merge</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Agent_Context-7C3AED?style=for-the-badge&logoColor=white" /></td>
<td><strong>SKILL.md context files · agent skills · openclaw.json</strong><br/>Any agent reads the context and skills · OpenClaw/NemoClaw add persistent automation</td>
</tr>
</table>

## Integration Tiers

Start with whatever agent you already use. Add tools when you want more automation.

<table>
<tr>
<td width="33%" valign="top">

### Tier 1 — Any Agent

Clone the repo, run `make dev`, and point your agent at `.skills/`. The SKILL.md context files and structured JSON logging work with Claude Code, Cursor, Copilot, or anything else that can read files.

**→ [Quick Start ↓](#quick-start)**

</td>
<td width="33%" valign="top">

### Tier 2 — + OpenClaw

Install OpenClaw and run `openclaw tui`. Your agent gains persistent automation: it watches dev servers, auto-fixes errors, scaffolds endpoints, deploys to AWS, and routes tasks between a local model and a frontier model.

**→ [Skills ↓](#skills) · [Config ↓](#configuration)**

</td>
<td width="33%" valign="top">

### Tier 3 — + NemoClaw

Add NemoClaw for sandboxed execution via OpenShell and privacy-routed local inference. Agent actions run in an isolated environment — no code leaves your machine.

**→ [Configuration ↓](#configuration)**

</td>
</tr>
</table>

| Capability | Tier 1 — Any Agent | Tier 2 — OpenClaw | Tier 3 — NemoClaw |
|---|:---:|:---:|:---:|
| SKILL.md project context | ✓ | ✓ | ✓ |
| Structured JSON logging | ✓ | ✓ | ✓ |
| Dev server watching + auto-debug | — | ✓ | ✓ |
| Agent skills (deploy, scaffold, test) | read | read + auto-run | read + auto-run |
| Model routing (local + frontier) | — | ✓ | ✓ |
| Sandboxed execution via OpenShell | — | — | ✓ |
| Privacy-routed local inference | — | — | ✓ |

---

## Quick Start

<a name="tier-1"></a>

**Prerequisites:** Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/)

```bash
# Clone the repo
git clone https://github.com/Benja-Pauls/ClawStack.git
cd ClawStack

# Interactive setup — configures project name, cloud, DB, auth, and agent tier
make init

# Install Python (uv) and Node (npm) dependencies
make setup

# Start Postgres + backend + frontend with hot reload
make dev
```

Your agent already knows the project. Try: _Watch the dev servers and tell me if anything breaks._

**Ready to build?** Follow the [Build Your First Feature](docs/tutorial.md) tutorial to add a complete Notes resource (model → migration → API → frontend) in ~15 minutes.

#### Adding OpenClaw (Tier 2)

<a name="tier-2"></a>

Install OpenClaw, then start the TUI alongside your dev servers:

```bash
# In a separate terminal
openclaw tui
```

The TUI tails both log streams and hands control to the skills in `.skills/`. See [Skills ↓](#skills) for what's included and how to write your own.

#### Adding NemoClaw (Tier 3)

<a name="tier-3"></a>

Install NemoClaw and the config in `.nemoclaw/` activates automatically. See [Configuration ↓](#configuration) for model routing and inference options.

## What's in the Box

```
clawstack/
├── backend/                # FastAPI + Python 3.12 (uv)
│   ├── app/
│   │   ├── main.py         # App factory — create_app()
│   │   ├── config.py       # Pydantic settings (env vars)
│   │   ├── logging_config.py
│   │   ├── routes/         # API route handlers (/api/v1/...)
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic layer
│   │   └── middleware/     # Logging, auth middleware
│   ├── tests/
│   └── migrations/         # Alembic migrations
├── frontend/               # React 18 + Vite + TypeScript + Tailwind v4
│   ├── src/
│   │   ├── App.tsx
│   │   ├── routes/         # Page components
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # React Query data-fetching hooks
│   │   ├── api/            # Typed API client (fetch-based)
│   │   └── types/          # TypeScript interfaces
│   └── tests/
├── infra/                  # Terraform (AWS)
│   ├── modules/            # networking, ecr, rds, app-runner
│   └── environments/       # dev, staging, prod configs
├── scripts/                # CLI tools (init.py, deploy.sh, deploy-init.sh)
├── .skills/                # Agent context files + action skills
├── .openclaw/              # OpenClaw model routing config
├── .nemoclaw/              # NemoClaw sandbox + inference config
├── docs/                   # Tutorial and guides
├── .github/workflows/      # CI + CD pipelines
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Skills

Skills are markdown instruction files that tell your agent _how_ to perform tasks in your project — specific file paths, commands, and decision trees. They live in `.skills/` alongside the context files, and any agent can read them. OpenClaw auto-discovers them; without it, point your agent at the skill file and it'll follow the instructions.

| Skill | Description |
|---|---|
| `dev-server` | Start backend + frontend, tail log streams, auto-detect and fix errors |
| `deploy` | Build Docker images, push to ECR, run Terraform, verify health checks |
| `scaffold` | Generate boilerplate for new API endpoints and frontend pages with type safety |
| `db-migrate` | Create Alembic migrations, run them, manage seed data |
| `test` | Run pytest/vitest, interpret failures, suggest and apply fixes |
| `git-workflow` | Feature branches, conventional commits, PR creation via `gh` |
| `find-skills` | Discover and install community skills from [ClawHub](https://clawhub.ai) |

**Writing your own skills:** A skill is just a `SKILL.md` file in a new subdirectory of `.skills/`. Write it as actionable instructions — specific commands, real file paths, decision logic — not as documentation. The [CONTRIBUTING guide](CONTRIBUTING.md#agent-skills) has the full format.

**Community skills:** [ClawHub](https://clawhub.ai) hosts 13,000+ community-built skills — your agent can search and install them via the `find-skills` skill. For curated picks, see [Awesome OpenClaw Skills](https://github.com/VoltAgent/awesome-openclaw-skills) or [OpenClaw Master Skills](https://github.com/LeoYeAI/openclaw-master-skills). Share ClawStack-specific skills in [GitHub Discussions → Skills](https://github.com/Benja-Pauls/ClawStack/discussions/categories/skills).

## Deploy to AWS

ClawStack includes Terraform modules for AWS App Runner, RDS (Postgres), ECR, and VPC networking. The `scripts/deploy.sh` script handles the full workflow: ECR auth, Docker build, image push, and `terraform apply`.

```bash
# One-time: bootstrap Terraform state (S3 bucket + DynamoDB lock table)
make deploy-init

# Build, push to ECR, and deploy (defaults to dev)
make deploy

# Deploy to a specific environment
make deploy env=staging
make deploy env=prod
```

For staging and prod, Terraform shows a plan for review before applying. Dev environments auto-approve.

## Configuration

Model routing is configured in `.openclaw/openclaw.json`. The default model handles fast coding tasks locally; the fallback sends to a frontier model when the primary is unavailable. Named agents (like `planning`) can override the default with a stronger model.

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "ollama/codestral",
        "fallbacks": ["anthropic/claude-opus-4-6"]
      }
    },
    "list": [
      {
        "id": "planning",
        "name": "Planning Agent",
        "model": {
          "primary": "anthropic/claude-opus-4-6"
        }
      }
    ]
  },
  "skills": {
    "load": {
      "extraDirs": [".skills"],
      "watch": true
    }
  }
}
```

To use cloud-only (no local models), change `primary` to your preferred cloud model and remove `fallbacks`. To swap local models, replace `codestral` with `qwen2.5-coder`, `deepseek-coder-v2`, or any Ollama-compatible model. The `skills.load.watch` option enables hot-reloading when you edit skill files.

## Customize

**Rename the project.** Run `make init` to set your project name, which updates `.env`, Terraform variables, and Docker image names.

**Swap the auth provider.** Set `AUTH_PROVIDER` in `.env` to `custom`, `clerk`, `auth0`, or `none`. The custom JWT provider works out of the box; Clerk and Auth0 have stub implementations with inline instructions in `backend/app/routes/auth.py`.

**Adjust Terraform for your AWS account.** Edit `infra/environments/{env}/main.tf` to change instance sizes, regions, or remove modules you don't need (e.g., drop the `rds` module if you already have a database).

**Modify skills.** Skills are plain markdown — edit any file in `.skills/` to match your workflow, or create new ones by adding a `SKILL.md` in a new subdirectory.

## Architectural Decisions

These are deliberate choices, not gaps. See [FAQ](docs/faq.md) for full rationale.

| Decision | Why |
|---|---|
| **Async SQLAlchemy** | AI agent apps multiplex long-running LLM calls (2-30s). Async handles thousands of concurrent connections vs. ~40 with sync threadpool. |
| **Testcontainers (real Postgres)** | UUID columns, `ON CONFLICT`, JSONB operators don't exist in SQLite. Real Postgres in CI catches real bugs. |
| **asyncpg driver** | Purpose-built async C driver — faster than psycopg async mode, fewer edge cases with SQLAlchemy async engine. |
| **No component library** | Opinionated choice. Tailwind + clean structure included; `npx shadcn@latest init` takes 5 minutes when you're ready. |
| **AWS App Runner** | Zero-config auto-scaling, TLS, health checks. Swap to ECS/Fargate Terraform module for GPU/sidecar needs. |
| **Rate limiting (in-memory)** | Works single-instance out of the box. Point at Redis for multi-instance production. |
| **`openapi-typescript`** | Auto-generates frontend types from FastAPI's OpenAPI spec via `make types`. No manual schema mirroring. |
| **Domain exceptions in services** | Services return `None`/raise domain errors, routes translate to HTTP. Services are reusable in CLI tools, workers, event handlers. |

## Contributing

Contributions are welcome. Each skill in `.skills/` is independently improvable — if you find a better error-detection pattern or a missing edge case, open a PR for just that skill.

For bugs and feature requests, [open an issue](https://github.com/Benja-Pauls/ClawStack/issues).

## License

[MIT](LICENSE)
