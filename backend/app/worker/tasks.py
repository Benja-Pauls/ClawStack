"""Background tasks for ARQ worker.

Define async background tasks here. Each task is a regular async function
that receives a context dict as its first argument.

Usage from routes or services:
    from arq.connections import ArqRedis, create_pool
    from app.worker.settings import WorkerSettings

    redis = await create_pool(WorkerSettings.redis_settings)
    await redis.enqueue_job("example_task", data={"key": "value"})

Running the worker:
    cd backend && uv run arq app.worker.settings.WorkerSettings
    # or from project root:
    make worker
"""

from __future__ import annotations

from typing import Any

from app.logging_config import get_logger

logger = get_logger(__name__)


async def example_task(ctx: dict[str, Any], *, data: dict[str, Any]) -> dict[str, Any]:
    """Example background task.

    Replace this with real tasks like:
    - Sending emails
    - Processing LLM responses
    - Generating reports
    - Data pipeline steps

    Args:
        ctx: ARQ context (contains redis connection, job info)
        data: Task-specific payload
    """
    job_id = ctx.get("job_id", "unknown")
    logger.info("task_started", task="example_task", job_id=job_id, data=data)

    # Your async work goes here
    result = {"processed": True, "input": data}

    logger.info("task_completed", task="example_task", job_id=job_id)
    return result
