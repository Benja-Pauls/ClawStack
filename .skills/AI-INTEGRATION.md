---
skill: ai-integration
version: 2
---

# Adding AI/LLM Features to Your App

SerpentStack is optimized for AI-agent-assisted *development* — but many apps built with it will also call LLM APIs as a product feature (chatbots, summarization, RAG, agents). This guide shows where those pieces fit in the existing architecture.

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
from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

# Install your preferred provider SDK:
#   cd backend && uv add anthropic     # Anthropic (Claude)
#   cd backend && uv add openai        # OpenAI (GPT)
#   cd backend && uv add google-genai  # Google (Gemini)
#
# Then import and initialize the client here.
# See official docs for the latest API:
#   Anthropic: https://docs.anthropic.com/en/api/messages
#   OpenAI:    https://platform.openai.com/docs/api-reference
#   Google:    https://ai.google.dev/gemini-api/docs
```

Then call from a route:

```python
@router.post("/api/v1/ai/complete")
async def complete(request: CompletionRequest, db: AsyncSession = Depends(get_db)):
    result = await ai_service.generate(request.prompt, system=request.system)
    return {"response": result}
```

## Streaming Responses

For chat UIs, use FastAPI's `StreamingResponse` with the provider's streaming API. A working SSE reference implementation is already at `backend/app/routes/stream.py` — replace the mock generator with your actual LLM client.

Key points:
- SSE (Server-Sent Events) is the standard transport for streaming AI completions
- Native browser support via EventSource API with automatic reconnection
- Works through proxies and load balancers
- Simpler than WebSockets for unidirectional streaming

See the existing `stream.py` for the full SSE event format and error handling pattern.

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
logger.info(
    "ai_completion",
    model=response.model,
    input_tokens=response.usage.input_tokens,
    output_tokens=response.usage.output_tokens,
)
```

Since SerpentStack already uses structured JSON logging, these events are queryable in CloudWatch or any log aggregator.

## Provider Libraries

Install with uv:

```bash
cd backend && uv add anthropic     # Anthropic (Claude) — https://docs.anthropic.com
cd backend && uv add openai        # OpenAI (GPT) — https://platform.openai.com/docs
cd backend && uv add google-genai  # Google (Gemini) — https://ai.google.dev/gemini-api/docs
```

Always refer to the provider's official documentation for the latest API signatures — SDKs are updated frequently.

## What This Is Not

This guide covers adding LLM features to your *application*. If you want an AI agent to help you *develop* the application, that's what the `.skills/` context files are for — see the README.
