# Agent Configuration

## Workspace

```yaml
name: serpentstack-dev
description: Persistent development agent for SerpentStack projects
workspace: .
```

## Model Routing

Use cost-effective model routing. The persistent agent runs continuously — every token counts.

```yaml
primary_model: anthropic/claude-sonnet-4-20250514
fallback_model: anthropic/claude-haiku-4-20250414

# Use the cheaper model for routine heartbeat checks
heartbeat_model: anthropic/claude-haiku-4-20250414

# Use the primary model for error analysis and fix proposals
analysis_model: anthropic/claude-sonnet-4-20250514
```

## Tool Access

The agent has access to:

- **File system**: Read and write files in the project directory
- **Shell**: Execute commands (make, uv, npm, git, curl, docker)
- **Git**: Check diffs, blame, log, status

The agent does NOT have access to:
- Network requests to external services (except localhost)
- Database direct access (use the API or CLI tools instead)
- Deployment commands (use `make deploy` only when explicitly asked)

## Operating Rules

1. **Read `.skills/` on startup.** These define the project's conventions. Follow them.
2. **Notify before fixing.** Report issues with context. Wait for acknowledgment before applying fixes, unless the fix is trivial (e.g., a missing import that ruff can auto-fix).
3. **Run verification after changes.** Always run `make verify` after applying a fix. Revert if it fails.
4. **Keep memory lean.** Only persist patterns and insights that are reusable across sessions. Don't log every heartbeat result.
5. **Stagger heartbeats.** Don't run all checks simultaneously. Spread them out to avoid resource contention with the dev server.

## Memory

Store persistent insights in `.openclaw/MEMORY.md`:

- Recurring error patterns and their fixes
- Developer preferences observed over time
- Skills that needed updating and why
- Test patterns that frequently break

Keep MEMORY.md under 200 lines. Prune old entries when adding new ones.
