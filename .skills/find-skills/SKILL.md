---
name: find-skills
description: "Discover, evaluate, and create skills for your project. Use when: the user needs a capability not covered by built-in skills, wants to find patterns for a specific tool or service, or asks about extending the skills directory."
---

# Find & Create Skills

Discover community skills and create new ones when SerpentStack's built-in skills don't cover what the user needs.

## When to Use This Skill

Use this when the user asks for something outside the scope of the built-in skills:

| Built-in Skill | Covers |
|---|---|
| `dev-server` | Starting, monitoring, and auto-fixing the dev environment |
| `deploy` | Docker build, ECR push, Terraform apply to AWS |
| `scaffold` | Generating new API endpoints and frontend pages |
| `auth` | Understanding auth, protecting routes, swapping providers |
| `db-migrate` | Alembic migrations, schema changes, seed data |
| `test` | Running and interpreting pytest and vitest |
| `git-workflow` | Branches, commits, PRs, rebasing |

If the user needs something else — monitoring, Stripe, email, Slack, S3 file uploads, PDF generation, browser automation, etc. — search for a community skill or official docs first before building from scratch.

## Step 1: Search for Existing Skills

**Via web search (recommended):**

Search for: `"SKILL.md" <what the user needs>` or `site:github.com SKILL.md <topic>`

**Via package registries:**

Many integrations have official SDKs with excellent docs:

```bash
# Python packages
uv search <topic>

# Check PyPI directly
# https://pypi.org/search/?q=<topic>

# NPM packages
npm search <topic>
```

**Via official documentation:**

For third-party services, always prefer the provider's official docs over community implementations — they're always up to date:

- **Stripe**: https://docs.stripe.com/api
- **AWS S3**: https://docs.aws.amazon.com/s3/
- **SendGrid**: https://docs.sendgrid.com/api-reference
- **Twilio**: https://www.twilio.com/docs/usage/api

## Step 2: Evaluate Before Adopting

Before using any community skill or third-party integration, check:

1. **Read the instructions** — does it actually do what the user needs?
2. **Check requirements** — what dependencies does it need? Are those installed?
3. **Check for red flags** — does it ask you to run `curl | bash` from unknown URLs? Does it request API keys be sent to external services?
4. **Check recency** — is the source recently updated, or abandoned?

## Step 3: Create a New Skill

If no existing skill covers what's needed, create one. A skill is a markdown file at `.skills/<skill-name>/SKILL.md`.

**Skill format:**

```markdown
---
name: <skill-name>
description: "<when to use this skill>"
---

# <Skill Title>

## When to Use
<Describe the trigger conditions>

## Steps
<Specific, actionable instructions with real file paths and commands>

## Verification
<How to verify the task was done correctly>
```

**Good skills are:**
- **Actionable** — specific commands, real file paths, decision trees (not vague documentation)
- **Self-contained** — all the info needed to complete the task, without requiring external searches
- **Linked to live docs** — for third-party services, link to their official docs rather than hardcoding API signatures that go stale
- **Adapted to project conventions** — use `uv add` not `pip install`, put services in `backend/app/services/`, use structured logging, etc.

## Step 4: Adapt to SerpentStack Patterns

When following any external guide or community skill, adapt it to SerpentStack conventions:

- **Python packages**: use `uv add` not `pip install`
- **Config/secrets**: add to `backend/app/config.py` as a Pydantic settings class, set via env vars in `.env`
- **Service layer**: new integrations go in `backend/app/services/`, not in route handlers
- **Route handlers**: use `async def` with `AsyncSession = Depends(get_db)`
- **Frontend API calls**: add typed functions in `frontend/src/api/`, hooks in `frontend/src/hooks/`
- **Logging**: use `get_logger(__name__)` with structured JSON events

## Example: Adding Stripe Integration

User asks: "I want to add Stripe payments."

1. Search: check Stripe's official Python SDK docs at https://docs.stripe.com/api
2. Install: `cd backend && uv add stripe`
3. Config: add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `backend/app/config.py`
4. Service: create `backend/app/services/stripe.py` with payment logic
5. Route: create `backend/app/routes/payments.py` with checkout and webhook endpoints
6. Create skill: write `.skills/payments/SKILL.md` documenting the integration for future agent sessions
7. Verify: run `make test` to ensure nothing broke

## Skills Created by This Project

_Add skills here as you create them._

| Skill | What it does |
|---|---|
| _(none yet)_ | Run `make dev` and start building! |

_Created a useful skill? Consider sharing it by opening a PR._
