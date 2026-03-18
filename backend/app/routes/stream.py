"""Server-Sent Events (SSE) streaming endpoint.

Demonstrates the SSE pattern for streaming LLM responses to the frontend.
This is a reference implementation — replace the mock generator with your
actual LLM client (OpenAI, Anthropic, etc.) for real usage.

SSE is the standard transport for streaming AI completions because:
- Native browser support via EventSource API
- Automatic reconnection
- Works through proxies and load balancers
- Simpler than WebSockets for unidirectional streaming
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/stream", tags=["streaming"])


async def _mock_llm_stream(prompt: str) -> AsyncGenerator[str, None]:
    """Simulate an LLM streaming response.

    Replace this with your actual LLM client. Examples:

        # OpenAI
        async for chunk in await openai.chat.completions.create(
            model="gpt-4", messages=[{"role": "user", "content": prompt}],
            stream=True
        ):
            yield chunk.choices[0].delta.content or ""

        # Anthropic
        async with anthropic.messages.stream(
            model="claude-sonnet-4-20250514", max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            async for text in stream.text_stream:
                yield text
    """
    words = (
        f"This is a simulated streaming response to: '{prompt}'. "
        "In production, replace _mock_llm_stream() with your LLM client. "
        "Each word arrives as a separate SSE event, just like a real "
        "language model streaming tokens."
    ).split()

    for word in words:
        yield word + " "
        await asyncio.sleep(0.05)


async def _sse_generator(prompt: str) -> AsyncGenerator[str, None]:
    """Format an LLM stream as SSE events.

    Event types:
    - "token": a chunk of the response text
    - "done": signals the stream is complete (data is empty)
    - "error": an error occurred (data contains error message)
    """
    try:
        async for token in _mock_llm_stream(prompt):
            data = json.dumps({"token": token})
            yield f"event: token\ndata: {data}\n\n"

        yield "event: done\ndata: {}\n\n"

    except Exception as exc:
        logger.error("stream_error", error=str(exc), prompt=prompt[:100])
        error_data = json.dumps({"error": str(exc)})
        yield f"event: error\ndata: {error_data}\n\n"


@router.get(
    "",
    summary="Stream a completion (SSE)",
    response_class=StreamingResponse,
    responses={
        200: {
            "description": "Server-Sent Events stream",
            "content": {"text/event-stream": {}},
        }
    },
)
async def stream_completion(
    prompt: str = Query(..., min_length=1, max_length=1000, description="The prompt to complete"),
) -> StreamingResponse:
    """Stream a completion response using Server-Sent Events.

    The response is a stream of SSE events:

    ```
    event: token
    data: {"token": "Hello "}

    event: token
    data: {"token": "world!"}

    event: done
    data: {}
    ```

    **Frontend usage (EventSource):**
    ```javascript
    const source = new EventSource('/api/v1/stream?prompt=Hello');
    source.addEventListener('token', (e) => {
        const { token } = JSON.parse(e.data);
        appendToUI(token);
    });
    source.addEventListener('done', () => source.close());
    source.addEventListener('error', (e) => {
        console.error('Stream error:', JSON.parse(e.data));
        source.close();
    });
    ```
    """
    logger.info("stream_started", prompt=prompt[:100])
    return StreamingResponse(
        _sse_generator(prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
