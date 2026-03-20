# Writing Project-Specific Skills

Generic skills teach agents how to code. Project-specific skills teach agents how to code **like your team does**. This guide explains how to write skills that actually change agent behavior for your project.

SerpentStack's `.skills/` directory follows the [Agent Skills open standard](https://agentskills.io/home) — the same SKILL.md format used by Claude Code, Codex, Cursor, Copilot, Gemini CLI, and others. Any agent that supports the standard will discover and use these skills automatically.

## Why Project-Specific Skills Matter

There are thousands of generic skills in marketplaces — "how to write tests," "how to create React components," "how to deploy to AWS." They're useful but they don't know your conventions.

When you tell an agent "add a Projects resource," a generic scaffold skill will produce something that compiles but doesn't match your patterns. A project-specific skill produces code that:

- Uses your transaction pattern (services flush, routes commit)
- Follows your ownership enforcement (`True`/`None`/`False` -> 204/404/403)
- Imports from the right places (`app.routes.auth`, not a generic auth module)
- Uses your test infrastructure (testcontainers, not SQLite mocks)
- Calls your API client (`apiRequest()`, not `fetch()`)

The difference between "it works" and "it fits" is what project-specific skills encode.

## The Format

Every skill is a directory under `.skills/` containing a `SKILL.md` file:

```
.skills/
  scaffold/
    SKILL.md      <- required
    scripts/      <- optional: executable code
    references/   <- optional: docs loaded into context
  auth/
    SKILL.md
  test/
    SKILL.md
```

The SKILL.md file has two parts — YAML frontmatter and markdown body:

```yaml
---
name: scaffold
description: "Generate boilerplate for new API endpoints following this project's conventions. Use when: adding a new resource, creating CRUD endpoints."
---

# Scaffold

[Instructions, examples, decision trees]
```

### Frontmatter Rules

- **`name`** (required): Must match the parent directory name. Lowercase letters, numbers, hyphens only. Max 64 characters.
- **`description`** (required): Max 1024 characters. This is the primary trigger — agents read this to decide whether to load the skill. Include both what it does AND when to use it.

The description is critical. Agents tend to under-trigger skills, so be specific about trigger conditions. Bad: `"Scaffold new resources."` Good: `"Generate boilerplate for new API endpoints following this project's conventions. Use when: adding a new resource, creating CRUD endpoints, wiring up a new frontend page, or asking 'how do I add a new feature end-to-end.'"`

### Body Guidelines

- Keep under 500 lines for optimal performance.
- Use concrete file paths, real import statements, and actual commands — not pseudocode.
- Include decision trees for branching logic (if X, do Y; if Z, do W).
- Link to live external docs for third-party services rather than hardcoding API signatures.

## What to Encode as a Skill

Not every convention needs a skill. Encode the things agents get wrong without guidance:

### High Value (Encode These)

| Convention | Why agents get it wrong |
|---|---|
| Transaction boundaries | Agents default to committing in service methods |
| Auth/ownership patterns | Agents skip ownership checks or raise wrong status codes |
| Service return contracts | Agents raise HTTPException in services instead of returning sentinel values |
| Test infrastructure | Agents mock the database instead of using your real test fixtures |
| Import paths | Agents guess module paths instead of using your actual project structure |
| API client patterns | Agents use raw `fetch()` instead of your typed wrapper |

### Low Value (Skip These)

| Convention | Why a skill isn't needed |
|---|---|
| Variable naming style | Linters catch this |
| File formatting | Formatters handle this |
| Basic language syntax | Agents already know this |
| Generic best practices | Already in the agent's training data |

The test: if an experienced developer would need to read your CONTRIBUTING.md to get this right, it should be a skill.

## Writing Effective Instructions

### Be Prescriptive, Not Descriptive

Bad (describes the pattern):
```markdown
Services should handle database operations and return appropriate values.
```

Good (prescribes exact behavior):
```markdown
Services call `await db.flush()` but never `db.commit()`. The route handler
owns the transaction boundary. Return values:
- Domain object: success
- `None`: not found
- `False`: exists but not owned by the requesting user
```

### Include Complete Templates

Don't describe what a file should contain — show the actual file. SerpentStack's `scaffold/SKILL.md` includes complete, copy-pasteable templates for every file in the chain (model, schema, service, route, test, frontend API client, React hooks). An agent reading it can produce a new resource end-to-end without guessing.

### Show the Chain, Not Just the Parts

A scaffold skill that only shows "here's how to write a model" isn't useful — the agent needs to know the full sequence: model -> schema -> service -> route -> register router -> migration -> tests -> frontend types -> API client -> hooks -> page component -> route registration.

Each step should reference the previous one so the agent understands dependencies.

### Encode Verification

Every skill should end with how to verify the work:

```markdown
## Verification

Run `make verify` to check lint + typecheck + tests for both ends.

For a new resource specifically:
1. `cd backend && uv run pytest tests/test_{name}.py -v` — all tests pass
2. `make types` — frontend types regenerated
3. `cd frontend && npx tsc --noEmit` — no type errors
```

## Composing Skills

Skills should reference each other rather than duplicating content:

- `scaffold/SKILL.md` references the auth pattern but doesn't re-explain it — it says "see `auth/SKILL.md` for the full auth architecture"
- `test/SKILL.md` explains the test infrastructure but doesn't re-explain the service return pattern — it says "services return `None`/`False`/object; see `scaffold/SKILL.md`"
- `find-skills/SKILL.md` lists all built-in skills so agents know what's already covered

This keeps each skill focused and under the 500-line limit.

## Testing Your Skills

A skill works if an agent reading it produces code that passes `make verify` on the first try. To test:

1. Start a fresh agent session (no prior context).
2. Ask it to perform the task the skill covers (e.g., "add a Projects resource").
3. Run `make verify`.
4. If it fails, read the error. The skill is missing the information the agent needed.
5. Update the skill and repeat.

Common failure modes:
- Agent used wrong import path -> add explicit import statements to the skill template
- Agent skipped ownership check -> add the ownership pattern to the service template
- Agent added `@pytest.mark.asyncio` -> add a note that `asyncio_mode = "auto"` is set
- Agent used `api.get()` instead of `apiRequest()` -> show the actual frontend API client

## Evolving Skills

Skills aren't static. Update them when:

- You change a pattern (e.g., switch from JWT to Clerk) — update `auth/SKILL.md`
- You add a new convention (e.g., soft deletes) — add it to `scaffold/SKILL.md`
- An agent keeps getting something wrong — the skill is missing information
- A dependency updates its API — update the relevant templates

The skills directory is the living specification of your project's conventions. If it's accurate, every agent session produces consistent, correct code. If it's stale, agents revert to guessing.

## Further Reading

- [Agent Skills Specification](https://agentskills.io/home) — the open standard
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — Anthropic's official guide
- [Anthropic Skills Repository](https://github.com/anthropics/skills) — reference implementations
