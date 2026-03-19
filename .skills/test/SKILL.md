---
name: serpentstack-test
description: "Run and interpret tests for SerpentStack backend and frontend. Use when: running test suites, debugging test failures, checking coverage, writing new tests."
---

# Test

Run and interpret tests for SerpentStack backend and frontend.

## Backend Tests (pytest)

### Run All Tests

```bash
cd backend && uv run pytest
```

### Run a Specific File

```bash
cd backend && uv run pytest tests/test_health.py
```

### Run a Specific Test

```bash
cd backend && uv run pytest tests/test_health.py::test_health_check -v
```

### Run with Coverage

```bash
cd backend && uv run pytest --cov=app --cov-report=term-missing
```

Look at the `Miss` column to find lines without test coverage.

### Test Infrastructure

Tests use a real PostgreSQL instance via testcontainers — a Docker container is spun up automatically per test session. This ensures tests exercise the same database features (UUID columns, JSONB, `ON CONFLICT`) used in production.

Each test gets an `AsyncSession` bound to an outer transaction with `join_transaction_mode="create_savepoint"`. This means when route handlers call `await db.commit()`, SQLAlchemy commits a **savepoint** — not the real transaction. The fixture rolls back the outer transaction after each test, keeping tests fully isolated. The async `httpx.AsyncClient` uses `dependency_overrides` to inject this test session.

**Requirement:** Docker must be running for tests to pass.

### Interpreting pytest Output

- **PASSED**: test is green, no action needed.
- **FAILED**: look for the `FAILED` summary line, then scroll up to the full assertion error.
- **ERROR**: a fixture or setup function raised an exception -- not a test logic failure but an infrastructure issue.

When a test fails:

1. Read the `AssertionError` message. It shows expected vs actual values.
2. Read the test function to understand what it asserts.
3. Read the source code being tested to understand the actual behavior.
4. Determine if the test is wrong (update the test) or the source is wrong (fix the source).
5. Re-run the specific test to confirm the fix: `uv run pytest <path>::<test_name> -v`.

### Common pytest Failures

| Pattern | Meaning | Action |
|---|---|---|
| `AssertionError: assert 200 == 422` | Endpoint validation rejected the request | Check request payload against Pydantic schema |
| `sqlalchemy.exc.ProgrammingError` | Missing table or column | Run `uv run alembic upgrade head` |
| `fixture 'X' not found` | Missing or misnamed test fixture | Check `conftest.py` files |
| `assert 'items' in data` fails | Response shape changed | Check if endpoint returns a wrapper object (`{Name}ListResponse`) |
| `ConnectionRefusedError` or container timeout | Docker is not running | Start Docker Desktop, then re-run tests |
| `docker.errors.DockerException` | Docker daemon unreachable | Check `docker ps` works, restart Docker if needed |
| `RuntimeError: no running event loop` | Missing `@pytest.mark.asyncio` | Add decorator to async test functions |
| `MissingGreenlet` / `await` in sync context | Accidentally called sync code in async path | Ensure all DB operations use `await` with `AsyncSession` |

## Frontend Tests (vitest)

### Run All Tests

```bash
cd frontend && npm test
```

### Run a Specific File

```bash
cd frontend && npm test -- tests/App.test.tsx
```

### Run in Watch Mode

```bash
cd frontend && npm run test:watch
```

### Run with Coverage

```bash
cd frontend && npm test -- --coverage
```

### Interpreting vitest Output

- Look for lines marked with a red X for failures.
- The diff output shows `Expected` vs `Received` values.
- For component tests, check if the rendered output matches expectations.

When a test fails:

1. Read the test name to understand the expected behavior.
2. Read the diff to see what diverged.
3. Read the component or function source to understand actual behavior.
4. Fix either the source (if behavior is wrong) or the test (if expectations are outdated).
5. Re-run: `npm test -- tests/path/to/file.test.tsx`.

### Common vitest Failures

| Pattern | Meaning | Action |
|---|---|---|
| `Element not found` | Component did not render the expected element | Check the component JSX and query selectors |
| `TypeError: X is not a function` | Mock not set up correctly | Verify `vi.mock()` calls match the import path |
| `act() warning` | State update outside of act wrapper | Wrap async operations in `waitFor` or `act` |
| Snapshot mismatch | Component output changed | Review the diff; update snapshot with `-u` if intentional |

## Full Suite

```bash
make test    # Runs backend + frontend tests
make lint    # Runs ruff + ESLint
```

## Test Strategy

- Write tests alongside new code. Every new endpoint gets at least one happy-path and one error test.
- Every new component gets a render test and an interaction test.
- Run the full suite before opening a PR: `make test && make lint`.
