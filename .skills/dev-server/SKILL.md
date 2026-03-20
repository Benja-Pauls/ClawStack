---
name: dev-server
description: "Monitor and auto-fix the development environment. Use when: debugging backend/frontend errors, watching log streams, diagnosing startup failures, or running make dev."
---

# Dev Server

## Starting the Dev Environment

```bash
make dev          # Starts Postgres, Redis, runs migrations, launches backend + frontend
make dev-docker   # Alternative: run everything in Docker
```

Backend: http://localhost:8000 · API docs: http://localhost:8000/api/docs
Frontend: http://localhost:5173

If `make dev` fails, check `docker compose ps` to verify Postgres is healthy.

## Error Detection Patterns

### Backend (FastAPI) — Structured JSON Logs

| Pattern | Meaning | Fix |
|---|---|---|
| `"level": "ERROR"` | Application error | Read `traceback`, `module`, `lineno` fields |
| `ModuleNotFoundError` | Missing dependency | `cd backend && uv add <package>` |
| `sqlalchemy.exc.OperationalError` | Database connection failed | Check Postgres is running, migrations are current |
| `sqlalchemy.exc.ProgrammingError: relation "X" does not exist` | Missing migration | `cd backend && uv run alembic upgrade head` |
| `pydantic.ValidationError` | Schema field mismatch | Compare request payload against Pydantic model |
| `ImportError: cannot import name 'X' from 'app.models'` | Model not exported | Add import to `backend/app/models/__init__.py` |

### Frontend (Vite/React)

| Pattern | Meaning | Fix |
|---|---|---|
| `TS\d{4}:` (e.g., `TS2345`) | TypeScript error | Read file path + line number from message |
| `[vite] Internal server error` | Build failure | Read full error below the message |
| `Module not found: Can't resolve` | Missing package | `cd frontend && npm install` or add the dependency |
| `Uncaught Error:` | React runtime error | Read component stack trace |
| `[hmr] Failed to reload` | HMR failure (usually syntax) | File path is in the message |

## Auto-Fix Workflow

When an error is detected:

1. **Classify**: syntax, type, import, runtime, or database error
2. **Locate**: extract file path and line number from the error output
3. **Check recent changes**: `git diff HEAD~1 -- <file>`
4. **Read the file**: open at the relevant line, read 20 lines of surrounding context
5. **Fix**: apply the minimal change to resolve the error
6. **Verify**: wait for hot-reload, confirm the error is gone

## Verification

```bash
make verify   # Runs lint + typecheck + test for both backend and frontend
```
