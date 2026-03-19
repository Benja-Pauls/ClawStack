---
name: serpentstack-db-migrate
description: "Manage database schema changes with Alembic in SerpentStack. Use when: creating migrations, adding tables or columns, checking migration status, rolling back."
---

# Database Migrations

Manage database schema changes with Alembic in SerpentStack.

## Prerequisites

- Postgres running: `docker compose up -d postgres`
- Backend dependencies installed: `cd backend && uv sync`

## Creating a New Migration

After modifying or adding a SQLAlchemy model:

```bash
cd backend && uv run alembic revision --autogenerate -m "describe the change"
```

The migration description should be concise and specific, e.g., "add projects table", "add email column to users", "create index on tasks.status".

Review the generated file in `backend/migrations/versions/`. Verify:

- The `upgrade()` function contains the expected `op.create_table`, `op.add_column`, or `op.create_index` calls.
- The `downgrade()` function is the inverse of upgrade.
- No unintended changes are included (Alembic sometimes detects phantom diffs).

## Running Migrations

Apply all pending migrations:

```bash
cd backend && uv run alembic upgrade head
```

Apply only the next migration:

```bash
cd backend && uv run alembic upgrade +1
```

## Checking Migration Status

See the current revision:

```bash
cd backend && uv run alembic current
```

See full migration history:

```bash
cd backend && uv run alembic history --verbose
```

## Downgrading

Roll back the last migration:

```bash
cd backend && uv run alembic downgrade -1
```

Roll back to a specific revision:

```bash
cd backend && uv run alembic downgrade <revision_id>
```

## Adding a New Table

Full workflow:

1. Create the model file at `backend/app/models/{name}.py` — inherit from `Base` (provides `id`, `created_at`, `updated_at`).
2. Import the model in `backend/app/models/__init__.py` so Alembic detects it.
3. Generate the migration: `cd backend && uv run alembic revision --autogenerate -m "add {name}s table"`.
4. Review the generated migration file.
5. Apply: `cd backend && uv run alembic upgrade head`.
6. Verify: connect to the database and confirm the table exists.

## Adding a Column to an Existing Table

1. Edit the model in `backend/app/models/{name}.py` -- add the new column.
2. Generate: `cd backend && uv run alembic revision --autogenerate -m "add {column} to {name}s"`.
3. Review: ensure only the expected `op.add_column` is present.
4. Apply: `cd backend && uv run alembic upgrade head`.

## Troubleshooting

| Problem | Solution |
|---|---|
| `Target database is not up to date` | Run `uv run alembic upgrade head` first |
| `Can't locate revision` | Check `alembic.ini` for correct `script_location` |
| Phantom diffs in autogenerate | Compare model against DB schema manually; add to Alembic's `exclude` list if needed |
| `relation already exists` | The migration was partially applied. Check `alembic_version` table and fix manually |
| Migration conflicts (multiple heads) | Run `uv run alembic merge heads -m "merge migrations"` |
| `ModuleNotFoundError` on model import | Ensure model is imported in `backend/app/models/__init__.py` |
| Docker not running | Testcontainers and local Postgres both require Docker Desktop to be running |

## Seed Data

Populate the database with sample development data:

```bash
make seed
```

This runs the async seed CLI command at `backend/app/cli/seed.py`. The seed script is idempotent — running it multiple times will not create duplicates (it checks for existing rows first).
