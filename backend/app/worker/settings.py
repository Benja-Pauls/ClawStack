"""ARQ worker settings.

Configures the background task worker. The worker connects to Redis
and processes jobs enqueued by the application.

Start the worker:
    cd backend && uv run arq app.worker.settings.WorkerSettings
    # or from project root:
    make worker
"""

from __future__ import annotations

import os
from typing import ClassVar

from arq.connections import RedisSettings

from app.worker.tasks import example_task


def _get_redis_settings() -> RedisSettings:
    """Parse Redis connection settings from environment."""
    redis_url = os.getenv("RATE_LIMIT_STORAGE_URI", "redis://localhost:6379")
    # Strip the redis:// prefix for ARQ's RedisSettings
    if redis_url.startswith("redis://"):
        host_port = redis_url.replace("redis://", "").split(":")
        host = host_port[0] or "localhost"
        port = int(host_port[1]) if len(host_port) > 1 else 6379
        return RedisSettings(host=host, port=port)
    return RedisSettings()


class WorkerSettings:
    """ARQ worker configuration.

    ARQ discovers this class by module path:
        arq app.worker.settings.WorkerSettings
    """

    # Task functions the worker can execute
    functions: ClassVar[list] = [example_task]

    # Redis connection
    redis_settings = _get_redis_settings()

    # Worker behavior
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    max_tries = 3
    health_check_interval = 30
