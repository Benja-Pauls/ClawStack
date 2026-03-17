---
skill: database
version: 1
---

# Database Guide (PostgreSQL + SQLAlchemy + Alembic)

## Setup

- **Local**: PostgreSQL 16 via Docker Compose (auto-started with `make dev`)
- **Production**: AWS RDS PostgreSQL, provisioned via Terraform

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

## Migrations (Alembic)

Migration files live in `backend/migrations/versions/`.

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

Seed scripts can be added to `scripts/seed.py` for development/testing.

## Database Session

Use synchronous sessions via dependency injection:

```python
from sqlalchemy.orm import Session
from app.models.base import get_db

def my_route(db: Session = Depends(get_db)):
    result = db.execute(select(Item))
```

Never create sessions manually in route handlers. Always use the `get_db` dependency.
The database engine is lazily initialized — it won't attempt a connection until first use.
