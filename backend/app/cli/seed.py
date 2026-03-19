"""Seed the database with sample data.

Usage:
    cd backend && uv run python -m app.cli.seed
    # or from project root:
    make seed

Uses async SQLAlchemy to match the application's database layer.
Reads DATABASE_URL from the application settings (same as the server).
"""

from __future__ import annotations

import asyncio

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger, setup_logging
from app.models.base import get_engine, get_session_factory
from app.models.item import Item
from app.models.user import User

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SEED_USER = {
    "email": "admin@example.com",
    "password": "password123",
    "name": "Admin User",
}

SEED_ITEMS = [
    {
        "name": "Setup CI/CD Pipeline",
        "description": "Configure GitHub Actions for automated testing and deployment.",
    },
    {
        "name": "Create Dashboard Page",
        "description": "Build a dashboard with key metrics and recent activity feed.",
    },
    {
        "name": "Write API Documentation",
        "description": "Generate OpenAPI docs and add usage examples for all endpoints.",
    },
    {
        "name": "Implement Search",
        "description": "Add full-text search across items using PostgreSQL tsvector.",
    },
]


async def seed() -> None:
    """Insert a test user and sample items if the database is empty."""
    session_factory = get_session_factory()

    async with session_factory() as db:
        db: AsyncSession

        # Seed test user
        user_result = await db.execute(select(func.count()).select_from(User))
        user_count = user_result.scalar_one()

        user = None
        if user_count == 0:
            user = User(
                email=SEED_USER["email"],
                hashed_password=pwd_context.hash(SEED_USER["password"]),
                name=SEED_USER["name"],
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)
            print(f"Seeded user: {SEED_USER['email']} / {SEED_USER['password']}")
        else:
            print(f"Database already has {user_count} users. Skipping user seed.")

        # Seed items
        item_result = await db.execute(select(func.count()).select_from(Item))
        item_count = item_result.scalar_one()

        if item_count > 0:
            print(f"Database already has {item_count} items. Skipping item seed.")
        else:
            for data in SEED_ITEMS:
                db.add(Item(**data, user_id=user.id if user else None))
            print(f"Seeded {len(SEED_ITEMS)} items.")

        await db.commit()

    # Clean up engine
    engine = get_engine()
    await engine.dispose()


def main() -> None:
    """Entry point for `python -m app.cli.seed`."""
    setup_logging()
    asyncio.run(seed())


if __name__ == "__main__":
    main()
