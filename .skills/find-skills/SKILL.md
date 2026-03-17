---
name: clawstack-find-skills
description: "Discover, evaluate, and install community skills from ClawHub and the OpenClaw ecosystem. Use when: the user needs a capability not covered by built-in skills, wants to find a skill for a specific tool or service, or asks about available skills."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
      },
  }
---

# Find Skills

Discover and install community skills from the OpenClaw ecosystem when ClawStack's built-in skills don't cover what the user needs.

## When to Use This Skill

Use this when the user asks for something outside the scope of the 6 built-in skills:

| Built-in Skill | Covers |
|---|---|
| `dev-server` | Starting, monitoring, and auto-fixing the dev environment |
| `deploy` | Docker build, ECR push, Terraform apply to AWS |
| `scaffold` | Generating new API endpoints and frontend pages |
| `db-migrate` | Alembic migrations, schema changes, seed data |
| `test` | Running and interpreting pytest and vitest |
| `git-workflow` | Branches, commits, PRs, rebasing |

If the user needs something else — monitoring, Stripe, email, Slack, S3 file uploads, PDF generation, browser automation, etc. — search for a community skill first before building from scratch.

## Step 1: Search ClawHub

ClawHub is the official skill registry with 13,000+ community skills.

**Via API (preferred — works without a browser):**

```bash
# Search by keyword
curl -s "https://clawhub.ai/api/v1/skills?q=stripe+payments" | python3 -m json.tool

# Get a specific skill's SKILL.md
curl -s "https://clawhub.ai/api/v1/skills/<owner>-<slug>/file?path=SKILL.md"
```

**Via web search (if you have web access):**

Search for: `site:clawhub.ai <what the user needs>` or `site:github.com openclaw skill SKILL.md <topic>`

**Curated lists (good starting points):**

- [Awesome OpenClaw Skills](https://github.com/VoltAgent/awesome-openclaw-skills) — 5,400+ skills filtered and categorized
- [OpenClaw Master Skills](https://github.com/LeoYeAI/openclaw-master-skills) — 339 curated best-of-breed skills
- [OpenClaw bundled skills](https://github.com/openclaw/openclaw/tree/main/skills) — 50+ skills shipped with OpenClaw

## Step 2: Evaluate the Skill

Before using any community skill, check:

1. **Read the SKILL.md** — does it actually do what the user needs?
2. **Check requirements** — look at the `requires.bins` in the frontmatter. Are those tools installed?
3. **Check for red flags** — does it ask you to run `curl | bash` from unknown URLs? Does it request API keys be sent to external services? (Treat third-party skills as untrusted code.)
4. **Check recency** — is the skill recently updated, or abandoned? Check the GitHub repo or ClawHub page.

## Step 3: Use the Skill

**Option A — Read and follow inline (recommended for one-off use):**

Fetch the SKILL.md content and follow its instructions directly. No installation needed.

```bash
# Fetch and read a skill
curl -s "https://clawhub.ai/api/v1/skills/<owner>-<slug>/file?path=SKILL.md"
```

Then follow the instructions in the skill as if they were given to you by the user.

**Option B — Install locally (for repeated use):**

Download the skill into the project's skills directory:

```bash
# Create skill directory
mkdir -p .skills/<skill-name>

# Download the SKILL.md
curl -s "https://clawhub.ai/api/v1/skills/<owner>-<slug>/file?path=SKILL.md" \
  > .skills/<skill-name>/SKILL.md
```

If the skill has additional files (check the ClawHub page), download those too.

**Option C — Install via OpenClaw CLI (if OpenClaw is running):**

```bash
openclaw skills install <owner>/<slug>
```

## Step 4: Adapt to ClawStack Patterns

Community skills are generic. When following a community skill in this project, adapt it to ClawStack conventions:

- **Python packages**: use `uv add` not `pip install`
- **Config/secrets**: add to `backend/app/config.py` as a Pydantic settings class, set via env vars in `.env`
- **Service layer**: new integrations go in `backend/app/services/`, not in route handlers
- **Route handlers**: use sync `def` with `Session = Depends(get_db)`, not `async def`
- **Frontend API calls**: add typed functions in `frontend/src/api/`, hooks in `frontend/src/hooks/`
- **Logging**: use `get_logger(__name__)` with structured JSON events

## Example: Finding a Monitoring Skill

User asks: "I want to add uptime monitoring for the deployed app."

1. Search: `curl -s "https://clawhub.ai/api/v1/skills?q=uptime+monitoring+health+check"`
2. Find a relevant skill (e.g., `healthcheck`, `uptime-kuma`, or `agentic-devops`)
3. Read its SKILL.md
4. Follow instructions, adapting any code to ClawStack patterns (Pydantic config, service layer, structured logging)
5. If it's useful long-term, install it locally in `.skills/`

## Skills the ClawStack Community Has Found Useful

_This section is a living list. Add skills here as you discover good ones._

| Skill | Source | What it does |
|---|---|---|
| `agentic-devops` | [ClawHub](https://clawskills.sh/skills/tkuehnl-agentic-devops) | Docker management, process monitoring, log analysis |
| `github` | [OpenClaw bundled](https://github.com/openclaw/openclaw/tree/main/skills/github) | GitHub operations via `gh` CLI — issues, PRs, CI runs |
| `coding-agent` | [OpenClaw bundled](https://github.com/openclaw/openclaw/tree/main/skills/coding-agent) | Delegate coding tasks to Codex, Claude Code, or other agents |

_Found a great skill? Add it to this table and open a PR._
