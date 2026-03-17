---
name: clawstack-dev-server
description: "Start, monitor, and auto-fix the ClawStack development environment. Use when: starting dev servers, debugging backend/frontend errors, watching log streams."
metadata:
  {
    "openclaw":
      {
        "emoji": "🖥️",
        "requires": { "bins": ["docker", "uv", "node"] },
      },
  }
---

# Dev Server

Start, monitor, and auto-fix the ClawStack development environment.

## Prerequisites

- Docker Desktop running (for Postgres)
- `uv` installed for Python dependency management
- `node` and `npm` installed for frontend

## Step 1: Start Postgres

```bash
docker compose up -d postgres
```

Verify it is healthy:

```bash
docker compose ps postgres
```

If the container is not healthy after 15 seconds, check logs with `docker compose logs postgres` and look for port conflicts or volume permission errors.

## Step 2: Run Database Migrations

```bash
cd backend && uv run alembic upgrade head
```

If this fails with "connection refused", Postgres is not ready. Wait 5 seconds and retry (max 3 attempts).

## Step 3: Start the Backend

```bash
cd backend && uv run uvicorn app.main:create_app --factory --reload --port 8000
```

Confirm startup by watching for the line: `Uvicorn running on http://127.0.0.1:8000`.

## Step 4: Start the Frontend

In a separate process:

```bash
cd frontend && npm run dev
```

Confirm startup by watching for `Local:   http://localhost:5173/` in the output.

## Step 5: Tail and Monitor Logs

Watch both log streams simultaneously. Parse each line and react to errors.

### Backend (FastAPI) Error Detection

FastAPI emits structured JSON logs. Look for these patterns:

- **Application error**: `"level": "ERROR"` -- extract `traceback`, `module`, and `lineno` fields.
- **Unhandled exception**: `"level": "CRITICAL"` or `Traceback (most recent call last)` in raw output.
- **Import error**: `ModuleNotFoundError` or `ImportError` -- usually a missing dependency. Fix: `cd backend && uv add <package>`.
- **Database error**: `sqlalchemy.exc.OperationalError` -- check if Postgres is running and migrations are current.
- **Pydantic validation**: `pydantic.ValidationError` -- read the field name and expected type from the traceback, then fix the schema or the input data.

### Frontend (Vite/React) Error Detection

- **TypeScript error**: Lines matching `TS\d{4}:` (e.g., `TS2345: Argument of type...`). Extract the file path, line number, and error code.
- **Build failure**: `[vite] Internal server error` or `Build failed with \d+ error`. Read the full error message below.
- **HMR failure**: `[hmr] Failed to reload` -- usually a syntax error. The file path is in the message.
- **React runtime error**: `Uncaught Error:` or `Error: Rendered fewer hooks than expected` -- indicates a component bug. Read the component stack trace.
- **Missing module**: `Module not found: Error: Can't resolve` -- run `cd frontend && npm install` or add the missing package.

## Step 6: Auto-Fix Workflow

When an error is detected:

1. **Classify** the error: syntax, type, import, runtime, database.
2. **Locate the source**: extract file path and line number from the error output.
3. **Check recent changes**: run `git diff HEAD~1 -- <file>` to see if a recent change caused the regression.
4. **Read the file**: open the file at the relevant line number, read 20 lines of surrounding context.
5. **Fix**: apply the minimal change to resolve the error.
6. **Verify**: wait for hot-reload to pick up the change. Confirm the error is gone from the log stream.

## Common Fix Patterns

| Error | Likely Cause | Fix |
|---|---|---|
| `ImportError: cannot import name 'X' from 'app.models'` | Model not exported | Add import to `backend/app/models/__init__.py` |
| `TS2307: Cannot find module '../api/X'` | Missing API client file | Create the file in `frontend/src/api/` |
| `sqlalchemy.exc.ProgrammingError: relation "X" does not exist` | Missing migration | Run `cd backend && uv run alembic upgrade head` |
| `TS2345: Argument of type 'X' is not assignable` | Type mismatch | Check the function signature and fix the caller or the type definition |
| `[vite] Pre-transform error: ...` | Syntax error in TSX | Read the file, fix the syntax, save |
| `pydantic.ValidationError: 1 validation error` | Schema field mismatch | Compare the request payload against the Pydantic model |

## Shutdown

Stop services gracefully:

```bash
# Frontend: Ctrl+C the npm process
# Backend: Ctrl+C the uvicorn process
docker compose down
```
