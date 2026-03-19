"""Pytest fixtures for the SerpentStack backend test suite.

Uses testcontainers to spin up a real PostgreSQL instance so tests
exercise the same database features (UUID columns, ON CONFLICT,
JSONB operators, etc.) used in production. The container is created
once per test session and reused across all tests.
"""

from __future__ import annotations

import os

# Force test env before any app imports (disables rate limiting, etc.)
os.environ["ENVIRONMENT"] = "test"

from collections.abc import AsyncGenerator, Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
    """Start a real PostgreSQL container for the test session."""
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def test_engine(postgres_container: PostgresContainer):
    """Create an async engine and set DATABASE_URL for the test Postgres container.

    Must set DATABASE_URL before app imports so the app uses the test database.
    Uses NullPool to avoid asyncpg connection reuse issues.
    """
    sync_url = postgres_container.get_connection_url()
    async_url = sync_url.replace("psycopg2", "asyncpg")
    os.environ["DATABASE_URL"] = async_url
    return create_async_engine(async_url, echo=False, poolclass=NullPool)


@pytest.fixture(scope="session", autouse=True)
async def create_tables(test_engine) -> AsyncGenerator[None, None]:
    """Create all tables once per test session."""
    from app.models.base import Base

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture()
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client using the app's DB. Truncates tables between tests."""
    from app.main import create_app
    from app.models.base import Base, get_engine, get_session_factory

    get_engine.cache_clear()
    get_session_factory.cache_clear()

    app = create_app()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client

    # Truncate tables for next test
    engine = get_engine()
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f"TRUNCATE TABLE {table.name} CASCADE"))
