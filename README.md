# 🐍 SerpentStack — Fullstack AI-Agent-Assisted Development Template

<p align="center"><img src="assets/serpentstack-logo.png" alt="SerpentStack" width="600" /></p>

<p align="center">
  <strong>The first fullstack template designed for AI-agent-assisted development.</strong><br/>
  FastAPI + React + Postgres + Terraform, pre-wired with context files and agent skills so your agent understands your project from the first commit.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml"><img src="https://github.com/Benja-Pauls/SerpentStack/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/Benja-Pauls/SerpentStack/releases/latest"><img src="https://img.shields.io/github/v/release/Benja-Pauls/SerpentStack" alt="Release" /></a>
  <img src="https://img.shields.io/badge/any_AI_agent-compatible-7c3aed" alt="Any AI agent compatible" />
  <a href="https://github.com/Benja-Pauls/SerpentStack/stargazers"><img src="https://img.shields.io/github/stars/Benja-Pauls/SerpentStack?style=social" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#deploy-to-aws">Deploy</a> ·
  <a href="docs/tutorial.md">Tutorial</a> ·
  <a href="#skills">Skills</a> ·
  <a href="#agent-integrations">Agent Integrations</a> ·
  <a href="#customize">Customize</a> ·
  <a href="docs/faq.md">FAQ</a>
</p>

---

## Why SerpentStack?

Every AI coding session starts cold. The agent doesn't know your project structure, your conventions, or why you're using Alembic instead of raw SQL. It hallucinates paths and scaffolds patterns that don't fit.

SerpentStack ships with SKILL.md context files your agent reads immediately, structured JSON logging it can parse programmatically, and automation skills for dev server watching, endpoint scaffolding, and one-command AWS deploys. The skills are plain markdown — any agent can follow them (Claude Code, Cursor, Copilot, or anything else that can read files).

See [Customize ↓](#customize) for how to make this fit with your own stack.

### The Stack

<table>
<tr>
<td width="160"><img src="https://img.shields.io/badge/Frontend-61DAFB?style=for-the-badge&logoColor=black" /></td>
<td><strong>React 18 · TypeScript · Vite 6 · Tailwind v4 · shadcn/ui</strong><br/>TanStack Query for data fetching · React Router v6 · Vitest</td>
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
<td><strong>SKILL.md context files · agent skills · .cursorrules · copilot-instructions</strong><br/>Works with any AI agent — Claude Code, Cursor, Copilot, and more</td>
</tr>
</table>

## Works With Any Agent

Clone the repo, run `make dev`, and point your agent at `.skills/`. The context files and skills are plain markdown — no vendor lock-in.

| Agent | How it picks up SerpentStack context |
|---|---|
| **Claude Code** | Reads `.skills/` automatically via CLAUDE.md, plus `.cursorrules` |
| **Cursor** | Reads `.cursorrules` automatically; point it at `.skills/` for deeper context |
| **GitHub Copilot** | Reads `.github/copilot-instructions.md` automatically |
| **Any other agent** | Point it at `.skills/PROJECT.md` — it links to everything else |

---

## Quick Start

**Prerequisites:** Python 3.12+, Node 22+, Docker, [uv](https://docs.astral.sh/uv/)

```bash
# Clone the repo
git clone https://github.com/Benja-Pauls/SerpentStack.git
cd SerpentStack

# Interactive setup — configures project name, cloud, DB, auth
make init

# Install Python (uv) and Node (npm) dependencies
make setup

# Start Postgres + Redis + backend + frontend with hot reload
make dev
```

Your agent already knows the project. Try: _Watch the dev servers and tell me if anything breaks._

**Ready to build?** Follow the [Build Your First Feature](docs/tutorial.md) tutorial to add a complete Notes resource (model → migration → API → frontend) in ~15 minutes.

## What's in the Box

```
serpentstack/
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
├── .skills/                # Agent context files + action skills (any agent)
├── docs/                   # Tutorial and guides
├── .github/workflows/      # CI + CD pipelines
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Skills

Skills are markdown instruction files that tell your agent _how_ to perform tasks in your project — specific file paths, commands, and decision trees. They live in `.skills/` alongside the context files. Point your agent at any skill file and it'll follow the instructions.

| Skill | Description |
|---|---|
| `dev-server` | Start backend + frontend, tail log streams, auto-detect and fix errors |
| `deploy` | Build Docker images, push to ECR, run Terraform, verify health checks |
| `scaffold` | Generate boilerplate for new API endpoints and frontend pages with type safety |
| `auth` | Understand auth architecture, protect routes, swap to Clerk/Auth0 |
| `db-migrate` | Create Alembic migrations, run them, manage seed data |
| `test` | Run pytest/vitest, interpret failures, suggest and apply fixes |
| `git-workflow` | Feature branches, conventional commits, PR creation via `gh` |
| `find-skills` | Discover community skills and create new ones for additional capabilities |

**Writing your own skills:** A skill is just a `SKILL.md` file in a new subdirectory of `.skills/`. Write it as actionable instructions — specific commands, real file paths, decision logic — not as documentation. The [CONTRIBUTING guide](CONTRIBUTING.md#agent-skills) has the full format.

**Share your skills:** Created a useful skill? Share it in [GitHub Discussions](https://github.com/Benja-Pauls/SerpentStack/discussions/categories/skills) or open a PR to add it to the template.

## Deploy to AWS

SerpentStack includes Terraform modules for AWS App Runner, RDS (Postgres), ECR, and VPC networking. The `scripts/deploy.sh` script handles the full workflow: ECR auth, Docker build, image push, and `terraform apply`.

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

> **Other cloud providers:** The application is standard Docker containers — it runs anywhere containers run. The AWS Terraform modules in `infra/` are a reference implementation. We'd welcome community-contributed Terraform modules for GCP (Cloud Run), Azure (Container Apps), or other platforms. See [CONTRIBUTING](CONTRIBUTING.md) if you're interested.

## Agent Integrations

SerpentStack works out of the box with any agent that can read files. Config files are included for popular tools:

| File | Agent | What it provides |
|---|---|---|
| `.skills/` | Any agent | Project context, action skills, and patterns |
| `.cursorrules` | Cursor | Architecture, conventions, commands |
| `.github/copilot-instructions.md` | GitHub Copilot | Same conventions, "Adding a New Endpoint" checklist |

## Customize

**Rename the project.** Run `make init` to set your project name, which updates `.env`, Terraform variables, and Docker image names.

**Swap the auth provider.** The template ships with working local JWT auth (register, login, bcrypt passwords). To swap to Clerk, Auth0, or your own SSO, follow the `auth` skill in `.skills/auth/SKILL.md` — you only need to replace one function (`get_current_user`), and all protected routes keep working.

**Adjust Terraform for your AWS account.** Edit `infra/environments/{env}/main.tf` to change instance sizes, regions, or remove modules you don't need (e.g., drop the `rds` module if you already have a database).

**Swap the UI component library.** The template pre-configures [shadcn/ui](https://ui.shadcn.com) because it copies component source into your project rather than adding a runtime dependency — no lock-in, no bundle impact until you use it. To use a different library (Material UI, Ark UI, your internal design system), delete `frontend/components.json` and the `ui` Makefile target, then install your preferred library normally. The rest of the frontend (React Query, Router, Tailwind) is unaffected.

**Modify skills.** Skills are plain markdown — edit any file in `.skills/` to match your workflow, or create new ones by adding a `SKILL.md` in a new subdirectory.

## Architectural Decisions

These are deliberate choices, not gaps. See [FAQ](docs/faq.md) for full rationale.

| Decision | Why |
|---|---|
| **Async SQLAlchemy** | AI agent apps multiplex long-running LLM calls (2-30s). Async handles thousands of concurrent connections vs. ~40 with sync threadpool. |
| **Testcontainers (real Postgres)** | UUID columns, `ON CONFLICT`, JSONB operators don't exist in SQLite. Real Postgres in CI catches real bugs. |
| **asyncpg driver** | Purpose-built async C driver — faster than psycopg async mode, fewer edge cases with SQLAlchemy async engine. |
| **shadcn/ui (pre-configured, zero components installed)** | shadcn/ui copies component source into your project — it's not a runtime dependency. The template ships the config (`components.json`) and a `make ui component=X` target so agents can add components on demand. No components are pre-installed; delete `components.json` to remove it entirely. See [Customize ↓](#customize) to swap UI libraries. |
| **AWS App Runner** | Zero-config auto-scaling, TLS, health checks. Swap to ECS/Fargate Terraform module for GPU/sidecar needs. |
| **Rate limiting (configurable storage)** | Uses in-memory storage for local dev, Redis for production. Set `RATE_LIMIT_STORAGE_URI` to switch backends. |
| **`openapi-typescript`** | Auto-generates frontend types from FastAPI's OpenAPI spec via `make types`. No manual schema mirroring. |
| **Domain exceptions in services** | Services return `None`/raise domain errors, routes translate to HTTP. Services are reusable in CLI tools, workers, event handlers. |

## Contributing

Contributions are welcome — especially:

- **Skills:** Each skill in `.skills/` is independently improvable. Better error-detection patterns, missing edge cases, or entirely new skills.
- **Cloud providers:** Terraform modules for GCP, Azure, or other platforms in `infra/`. The AWS modules serve as a reference.
- **Agent integrations:** Config files for additional AI coding agents.

For bugs and feature requests, [open an issue](https://github.com/Benja-Pauls/SerpentStack/issues).

## License

[MIT](LICENSE)
