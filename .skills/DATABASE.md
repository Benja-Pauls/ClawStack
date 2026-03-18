---
skill: database
version: 2
---

# Database Guide (PostgreSQL + async SQLAlchemy + Alembic)

## Setup

- **Local**: PostgreSQL 16 via Docker Compose (auto-started with `make dev`)
- **Production**: AWS RDS PostgreSQL, provisioned via Terraform
- **Driver**: asyncpg (pure C async driver for asyncio)

## SQLAlchemy Models

Models live in `backend/app/models/`. Inherit from `Base` which provides id, created_at, updated_at:

```python
from app.models.base import Base
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

class Item(Base):
    __tablename__ = "items"
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
```

## Adding a New Table

1. Create model file in `backend/app/models/` (e.g., `models/item.py`)
2. Import model in `models/__init__.py` so Alembic detects it
3. Create matching Pydantic schemas in `schemas/`
4. Generate migration: `make migrate-new name="add_items_table"`
5. Run migration: `make migrate`
6. Add service layer in `services/` and route in `routes/`
7. Run `make types` to auto-generate frontend TypeScript types

## Migrations (Alembic)

Migration files live in `backend/migrations/versions/`. Alembic uses the async engine natively (see `migrations/env.py`).

```bash
make migrate-new name="description"   # Generate new migration
make migrate                          # Apply pending migrations
```

Always review generated migrations before applying. Alembic autogenerate may miss some changes.

## Conventions

- **Primary keys**: UUID on all tables (never auto-increment integers)
- **Timestamps**: `created_at` and `updated_at` on every table
- **Naming**: snake_case for table and column names
- **Foreign keys**: Use UUID, name as `<referenced_table>_id`
- **Indexes**: Add indexes for columns used in WHERE/JOIN clauses
- **Soft deletes**: Use `deleted_at` timestamp column when needed (not required by default)

## Seed Data

Populate the database with sample development data:

```bash
make seed
```

This runs the async seed CLI command at `backend/app/cli/seed.py`. The seed script is idempotent — running it multiple times will not create duplicates.

## Database Session

Use async sessions via dependency injection:

```python
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import get_db

async def my_route(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Item))
```

Never create sessions manually in route handlers. Always use the `get_db` dependency.
The database engine is lazily initialized — it won't attempt a connection until first use.

## Testing

Tests use a real PostgreSQL instance via testcontainers (not SQLite). Docker must be running. The test container is created once per session and reused. Each test gets a transactional rollback for isolation.
