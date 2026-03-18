"""Seed the database with sample data."""

import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Add backend to path so we can import models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.models.base import Base
from app.models.item import Item


# The app uses an async URL (postgresql+asyncpg://); convert to sync for seeding
_raw_url = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://clawstack:clawstack@localhost:5432/clawstack"
)
DATABASE_URL = _raw_url.replace("+asyncpg", "")

SEED_ITEMS = [
    {
        "name": "Setup CI/CD Pipeline",
        "description": "Configure GitHub Actions for automated testing and deployment.",
    },
    {
        "name": "Add Authentication",
        "description": "Integrate Clerk or Auth0 for user authentication and session management.",
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


def seed():
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        existing = session.query(Item).count()
        if existing > 0:
            print(f"Database already has {existing} items. Skipping seed.")
            return

        for data in SEED_ITEMS:
            session.add(Item(**data))

        session.commit()
        print(f"Seeded {len(SEED_ITEMS)} items.")


if __name__ == "__main__":
    seed()
