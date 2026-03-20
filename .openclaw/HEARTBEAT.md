# Heartbeat Schedule

Periodic checks this agent runs automatically. Each check should be lightweight — read logs, run a quick command, report only if something needs attention.

## Every 30 seconds: Dev Server Health

Check if the backend and frontend processes are running and healthy.

```
1. Check if backend is responding: curl -sf http://localhost:8000/api/v1/health
2. Check if frontend is responding: curl -sf http://localhost:5173
3. If either fails, report [ERROR] with which service is down and suggest `make dev` to restart.
```

## Every 60 seconds: Log Scan

Scan recent backend logs for errors. Look for patterns from `.skills/dev-server/SKILL.md`:

```
1. Check backend logs for "level": "ERROR", ModuleNotFoundError, sqlalchemy.exc, pydantic.ValidationError
2. Check frontend output for TS errors (TS\d{4}), vite internal errors, module not found
3. For each error found:
   - Extract file path and line number
   - Read the file at that location
   - Check git diff to see if it was a recent change
   - Report [ERROR] with context and proposed fix
```

## Every 5 minutes: Test Suite

Run the fast test subset to catch regressions early.

```
1. Run: cd backend && uv run pytest --tb=short -q --timeout=30
2. If any test fails:
   - Report [TEST FAILURE] with test name and assertion error
   - Read the failing test to understand what it checks
   - Read the source code being tested
   - Propose whether the test or the source needs fixing
3. If all pass, report nothing (silence = healthy).
```

## Every 15 minutes: Lint & Type Check

```
1. Run: cd backend && uv run ruff check .
2. Run: cd frontend && npx tsc --noEmit
3. Report only new issues (compare against last run).
```

## Every hour: Skill Freshness

Check if any skills are stale — code changed but the skill wasn't updated.

```
1. For each skill in .skills/:
   - Read the SKILL.md
   - Check if files it references still exist and match the described patterns
   - Check git log for recent changes to referenced files
2. If a skill references a pattern that no longer matches the code:
   - Report [STALE SKILL] with which skill and what changed
   - Propose an update to the skill
```

## On File Change: Quick Validation

When a Python file in `backend/app/` changes:

```
1. Run ruff on just that file: cd backend && uv run ruff check <file>
2. If it fails, report [LINT] with the specific issue
3. If the file is a model, check if a migration might be needed:
   - Compare model fields against the latest migration
   - If there's a mismatch, report [MIGRATION NEEDED]
```

When a TypeScript file in `frontend/src/` changes:

```
1. Check if tsc reports errors for that file
2. If ESLint is configured, run it on just that file
3. Report only new issues
```
