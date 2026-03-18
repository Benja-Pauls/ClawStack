"""Pytest fixtures for the ClawStack backend test suite.

Uses testcontainers to spin up a real PostgreSQL instance so tests
exercise the same database features (UUID columns, ON CONFLICT,
JSONB operators, etc.) used in production. The container is created
once per test session and reused across all tests.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Generator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from testcontainers.postgres import PostgresContainer

from app.main import create_app
from app.models.base import Base, get_db


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresContainer, None, None]:
    """Start a real PostgreSQL container for the test session."""
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg


@pytest.fixture(scope="session")
def test_engine(postgres_container: PostgresContainer):
    """Create an async engine connected to the test Postgres container."""
    # testcontainers gives us a psycopg2 URL; convert to asyncpg
    sync_url = postgres_container.get_connection_url()
    async_url = sync_url.replace("psycopg2", "asyncpg")
    return create_async_engine(async_url, echo=False)


@pytest.fixture(scope="session", autouse=True)
async def create_tables(test_engine) -> AsyncGenerator[None, None]:
    """Create all tables once per test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture()
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional async database session for each test.

    Uses ``join_transaction_block=True`` so that when route handlers
    call ``await db.commit()``, SQLAlchemy commits a SAVEPOINT instead
    of the outer transaction.  This lets the fixture roll back
    everything after each test, keeping tests fully isolated.
    """
    async with test_engine.connect() as connection:
        transaction = await connection.begin()

        session = AsyncSession(bind=connection, join_transaction_block=True)

        yield session

        await session.close()
        if transaction.is_active:
            await transaction.rollback()


@pytest.fixture()
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provide an async test client with the test DB session injected."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client
