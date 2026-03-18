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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.logging_config import get_logger, setup_logging
from app.models.base import get_engine, get_session_factory
from app.models.item import Item

logger = get_logger(__name__)

SEED_ITEMS = [
    {
        "name": "Setup CI/CD Pipeline",
        "description": ("Configure GitHub Actions for automated testing and deployment."),
    },
    {
        "name": "Add Authentication",
        "description": ("Integrate Clerk or Auth0 for user authentication and session management."),
    },
    {
        "name": "Create Dashboard Page",
        "description": ("Build a dashboard with key metrics and recent activity feed."),
    },
    {
        "name": "Write API Documentation",
        "description": ("Generate OpenAPI docs and add usage examples for all endpoints."),
    },
    {
        "name": "Implement Search",
        "description": ("Add full-text search across items using PostgreSQL tsvector."),
    },
]


async def seed() -> None:
    """Insert sample items if the database is empty."""
    session_factory = get_session_factory()

    async with session_factory() as db:
        db: AsyncSession
        result = await db.execute(select(func.count()).select_from(Item))
        count = result.scalar_one()

        if count > 0:
            print(f"Database already has {count} items. Skipping seed.")
            return

        for data in SEED_ITEMS:
            db.add(Item(**data))

        await db.commit()
        print(f"Seeded {len(SEED_ITEMS)} items.")

    # Clean up engine
    engine = get_engine()
    await engine.dispose()


def main() -> None:
    """Entry point for `python -m app.cli.seed`."""
    setup_logging()
    asyncio.run(seed())


if __name__ == "__main__":
    main()
