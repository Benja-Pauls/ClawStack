---
skill: ai-integration
version: 1
---

# Adding AI/LLM Features to Your App

ClawStack is optimized for AI-agent-assisted *development* — but many apps built with it will also call LLM APIs as a product feature (chatbots, summarization, RAG, agents). This guide shows where those pieces fit in the existing architecture.

## API Keys and Configuration

Add provider credentials to the existing Pydantic settings pattern in `backend/app/config.py`:

```python
class AISettings(BaseModel):
    provider: str = "anthropic"           # anthropic, openai, etc.
    api_key: str = ""                     # Set via AI__API_KEY env var
    model: str = "claude-sonnet-4-20250514"
    max_tokens: int = 4096

class Settings(BaseSettings):
    # ... existing fields ...
    ai: AISettings = AISettings()
```

Set in `.env`:

```
AI__PROVIDER=anthropic
AI__API_KEY=sk-ant-...
AI__MODEL=claude-sonnet-4-20250514
```

Never commit API keys. The `.env` file is already in `.gitignore`.

## Service Layer Pattern

LLM calls belong in the service layer, not in route handlers. Create `backend/app/services/ai.py`:

```python
import anthropic
from app.config import settings

def get_ai_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ai.api_key)

def generate_completion(prompt: str, system: str | None = None) -> str:
    client = get_ai_client()
    message = client.messages.create(
        model=settings.ai.model,
        max_tokens=settings.ai.max_tokens,
        system=system or "You are a helpful assistant.",
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text
```

Then call from a route:

```python
@router.post("/api/v1/ai/complete")
def complete(request: CompletionRequest, db: Session = Depends(get_db)):
    result = generate_completion(request.prompt, system=request.system)
    return {"response": result}
```

## Streaming Responses

For chat UIs, use FastAPI's `StreamingResponse` with the provider's streaming API:

```python
from fastapi.responses import StreamingResponse

def stream_completion(prompt: str, system: str | None = None):
    client = get_ai_client()
    with client.messages.stream(
        model=settings.ai.model,
        max_tokens=settings.ai.max_tokens,
        system=system or "You are a helpful assistant.",
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {text}\n\n"
    yield "data: [DONE]\n\n"

@router.post("/api/v1/ai/stream")
def stream(request: CompletionRequest):
    return StreamingResponse(
        stream_completion(request.prompt, request.system),
        media_type="text/event-stream",
    )
```

## Tool Use / Function Calling

Define tools as plain Python functions, then pass their schemas to the LLM:

```python
tools = [
    {
        "name": "search_items",
        "description": "Search items in the database",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"}
            },
            "required": ["query"],
        },
    }
]

def handle_tool_call(name: str, input: dict, db: Session):
    if name == "search_items":
        return item_service.search_items(db, input["query"])
```

This keeps tool implementations in the service layer where they can access the database and other services.

## Provider Libraries

Install with uv:

```bash
cd backend && uv add anthropic     # Anthropic (Claude)
cd backend && uv add openai        # OpenAI (GPT)
cd backend && uv add google-genai  # Google (Gemini)
```

## Frontend: Consuming Streams

Use the EventSource API or fetch with a ReadableStream in your React components:

```typescript
async function streamChat(prompt: string, onChunk: (text: string) => void) {
  const response = await fetch("/api/v1/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      const text = line.slice(6);
      if (text !== "[DONE]") onChunk(text);
    }
  }
}
```

## Cost Tracking

Log token usage from API responses for cost monitoring:

```python
from app.logging_config import get_logger
logger = get_logger(__name__)

def generate_completion(prompt: str, system: str | None = None) -> str:
    client = get_ai_client()
    message = client.messages.create(...)

    logger.info(
        "ai_completion",
        model=message.model,
        input_tokens=message.usage.input_tokens,
        output_tokens=message.usage.output_tokens,
    )
    return message.content[0].text
```

Since ClawStack already uses structured JSON logging, these events are queryable in CloudWatch or any log aggregator.

## What This Is Not

This guide covers adding LLM features to your *application*. If you want an AI agent to help you *develop* the application, that's what the `.skills/` context files and OpenClaw integration are for — see the README's Integration Tiers section.
