# 🦞 ClawStack - Fullstack AI-Agent-Assisted Development Template

<p align="center"><img src="assets/clawstack-logo.png" alt="ClawStack" width="600" /></p>

<p align="center">
  <strong>The first fullstack template designed for AI-agent-assisted development.</strong><br/>
  FastAPI + React + Postgres + Terraform, pre-wired with context files and OpenClaw skills so your agent understands your project from the first commit.
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
  <a href="#faq">FAQ</a>
</p>

---

## Why ClawStack?

Every AI coding session starts cold. The agent doesn't know your project structure, your conventions, or why you're using Alembic instead of raw SQL. It hallucinates paths and scaffolds patterns that don't fit.

ClawStack ships with SKILL.md context files your agent reads immediately, structured JSON logging it can parse programmatically, and — with OpenClaw — automation skills for dev server watching, endpoint scaffolding, and one-command AWS deploys.

See [Customize ↓](#customize) for how to make this fit with your own stack.

### The Stack

<table>
<tr>
<td width="160"><img src="https://img.shields.io/badge/Frontend-61DAFB?style=for-the-badge&logoColor=black" /></td>
<td><strong>React 18 · TypeScript · Vite 6 · Tailwind v4</strong><br/>TanStack Query for data fetching · React Router v6 · Vitest</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Backend-22C55E?style=for-the-badge&logoColor=white" /></td>
<td><strong>FastAPI · Python 3.12 · uv</strong><br/>Pydantic settings · structured JSON logging · typed schemas</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Database-336791?style=for-the-badge&logoColor=white" /></td>
<td><strong>PostgreSQL · SQLAlchemy 2.0 · Alembic</strong><br/>Docker locally · RDS in AWS · migrations via Alembic</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Infra-FF9900?style=for-the-badge&logoColor=white" /></td>
<td><strong>Terraform · AWS App Runner · ECR · RDS</strong><br/>VPC networking included · dev / staging / prod environments</td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/CI-24292E?style=for-the-badge&logoColor=white" /></td>
<td><strong>GitHub Actions · pytest · Vitest</strong><br/>Lint + test on every push · deploy workflow in <code>scripts/</code></td>
</tr>
<tr>
<td><img src="https://img.shields.io/badge/Agent_Context-7C3AED?style=for-the-badge&logoColor=white" /></td>
<td><strong>SKILL.md files · OpenClaw skills · openclaw.json</strong><br/>Any agent reads the context files · OpenClaw/NemoClaw unlock automation</td>
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
| Custom skills (deploy, scaffold, test) | — | ✓ | ✓ |
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
cd clawstack

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

The TUI tails both log streams and hands control to the skills in `.openclaw/skills/`. See [Skills ↓](#skills) for what's included and how to write your own.

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
├── .skills/                # Agent context files (any agent)
├── .openclaw/              # OpenClaw skills + model routing config
├── .nemoclaw/              # NemoClaw sandbox + inference config
├── .github/workflows/      # CI pipeline (lint + test)
├── docker-compose.yml
├── Makefile
└── .env.example
```

## Skills

OpenClaw skills are markdown instruction files that tell the agent _how_ to perform tasks in your project — specific file paths, commands, and decision trees. They live in `.openclaw/skills/`.

| Skill | Description |
|---|---|
| `dev-server` | Start backend + frontend, tail log streams, auto-detect and fix errors |
| `deploy` | Build Docker images, push to ECR, run Terraform, verify health checks |
| `scaffold` | Generate boilerplate for new API endpoints and frontend pages with type safety |
| `db-migrate` | Create Alembic migrations, run them, manage seed data |
| `test` | Run pytest/vitest, interpret failures, suggest and apply fixes |
| `git-workflow` | Feature branches, conventional commits, PR creation via `gh` |

**Writing your own skills:** A skill is just a `SKILL.md` file in a new subdirectory of `.openclaw/skills/`. Write it as actionable instructions — specific commands, real file paths, decision logic — not as documentation. The [CONTRIBUTING guide](CONTRIBUTING.md#agent-skills) has the full format.

**Community skills:** Share skills or find ones built by others in [GitHub Discussions → Skills](https://github.com/Benja-Pauls/ClawStack/discussions/categories/skills). If a skill is broadly useful (monitoring, Stripe integration, cron jobs, etc.), open a PR to add it to the template.

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

Model routing is configured in `.openclaw/openclaw.json`. The primary model handles fast coding tasks locally; the fallback sends planning and architecture tasks to a frontier model.

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "ollama/codestral",
        "fallbacks": ["anthropic/claude-opus-4-6"]
      }
    },
    "planning": {
      "model": {
        "primary": "anthropic/claude-opus-4-6"
      }
    }
  }
}
```

To use cloud-only (no local models), change `primary` to your preferred cloud model and remove `fallbacks`. To swap local models, replace `codestral` with `qwen2.5-coder`, `deepseek-coder-v2`, or any Ollama-compatible model.

## Customize

**Rename the project.** Run `make init` to set your project name, which updates `.env`, Terraform variables, and Docker image names.

**Swap the auth provider.** Set `AUTH_PROVIDER` in `.env` to `custom`, `clerk`, `auth0`, or `none`. The custom JWT provider works out of the box; Clerk and Auth0 have stub implementations with inline instructions in `backend/app/routes/auth.py`.

**Adjust Terraform for your AWS account.** Edit `infra/environments/{env}/main.tf` to change instance sizes, regions, or remove modules you don't need (e.g., drop the `rds` module if you already have a database).

**Modify skills.** Skills are plain markdown — edit any file in `.openclaw/skills/` to match your workflow, or create new ones by adding a `SKILL.md` in a new subdirectory.

## FAQ

**Do I need OpenClaw to use this?**
No. The `.skills/` context files are plain markdown that works with Claude Code, Cursor, Copilot, or any agent that can read files. OpenClaw adds persistent automation (dev server watching, one-command deploy skills) but isn't required.

**Do I need NemoClaw?**
No. NemoClaw is optional and adds sandboxed execution via OpenShell and privacy-routed local inference via Nemotron models. The config in `.nemoclaw/` activates when NemoClaw is installed.

**Can I use a different database or cloud provider?**
Yes. Set `DATABASE_URL` in `.env` to any Postgres-compatible connection string (Supabase, Neon, CockroachDB, self-hosted). For a different cloud, the app is standard Docker containers — replace the `infra/` Terraform modules or deploy to Railway, Fly.io, or any container platform.

**How do I add a new API endpoint?**
Use the `scaffold` skill if you're running OpenClaw, or follow the [Build Your First Feature](docs/tutorial.md) tutorial — it walks through adding a complete resource (model, migration, schemas, service, route, tests, frontend) end-to-end. For a quick reference, see `.skills/BACKEND.md`.

## Contributing

Contributions are welcome. Each skill in `.openclaw/skills/` is independently improvable — if you find a better error-detection pattern or a missing edge case, open a PR for just that skill.

For bugs and feature requests, [open an issue](https://github.com/Benja-Pauls/ClawStack/issues).

## License

[MIT](LICENSE)
