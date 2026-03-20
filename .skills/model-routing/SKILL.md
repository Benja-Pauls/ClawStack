---
name: model-routing
description: "Delegate coding subtasks to on-device local models (Ollama) to reduce cloud API costs while keeping the orchestrating model for planning and review. Use when: the user wants to save on API costs, asks about local models, mentions Ollama, or wants to use on-device models for code generation."
---

# Model Routing: Cloud Orchestration + Local Code Generation

Use expensive cloud models (Opus, Sonnet) for planning, review, and orchestration. Delegate token-heavy code generation to on-device models via Ollama. This can reduce costs 10-50x for coding-heavy sessions.

## Prerequisites

- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- A coding-capable model pulled: `ollama pull qwen3-coder:30b` (recommended) or `ollama pull glm-4.7-flash`
- Minimum 16GB RAM (24GB+ recommended for best results)

## How It Works

```
You (developer)
  |
  v
Cloud Model (Sonnet/Opus) — orchestration, planning, review
  |
  |-- "Write the service layer for Projects"
  |       |
  |       v
  |   Local Model (Ollama) — code generation subagent
  |       |
  |       returns generated code
  |
  |-- Reviews output, checks against project conventions
  |-- Requests corrections if needed
  |-- Commits the final result
```

The cloud model decides WHAT to build and HOW it should work. The local model does the token-heavy GENERATION. The cloud model reviews the output.

## Setup

### Option 1: Claude Code Subagent (Recommended)

Create a custom subagent definition in your project that delegates to a local Ollama instance. In your `.claude/settings.json` or project config:

```json
{
  "subagents": {
    "local-coder": {
      "description": "Fast local model for code generation tasks",
      "provider": "ollama",
      "model": "qwen3-coder:30b",
      "base_url": "http://localhost:11434",
      "tools": ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      "prompt": "You are a code generation assistant. Follow the project conventions described below exactly. Generate only the requested code — no explanations unless asked."
    }
  }
}
```

Then in your workflow, the orchestrating model can delegate:
"Use the local-coder subagent to generate the service file for Projects following the template in `.skills/scaffold/SKILL.md`."

### Option 2: Ollama as Primary with Cloud Fallback

Set Ollama as the default model and use cloud models only for complex reasoning:

```bash
# In your shell profile or .env
export ANTHROPIC_BASE_URL=http://localhost:11434
export ANTHROPIC_AUTH_TOKEN=ollama
export CLAUDE_MODEL=qwen3-coder:30b
```

This makes ALL generation local. Use `/model sonnet` in Claude Code to switch to cloud for planning/review tasks.

### Option 3: Manual Delegation

Without any configuration, you can simply instruct the agent:

"For the next code generation task, spawn a subagent using the local Ollama model. Have it generate the code, then review the output yourself before applying it."

## What to Delegate Locally

Good candidates for local generation (token-heavy, pattern-following):
- Boilerplate code from templates (models, schemas, services, routes)
- Test files following existing patterns
- Frontend components matching existing conventions
- Migration files
- API client functions
- Type definitions

Keep on cloud (requires reasoning, project understanding):
- Architecture decisions
- Debugging complex errors
- Code review and convention checking
- Multi-file refactors that require understanding dependencies
- Skill authoring and updates

## Project Context for Local Models

Local models don't have your conversation history. When delegating, include the relevant skill content in the subagent prompt. For example, when generating a new service:

"Read `.skills/scaffold/SKILL.md` section '3. Service Layer' and generate a service file for Projects following that exact template. The resource name is `project`, the model is `Project`."

This gives the local model enough context to produce correct code without needing the full conversation.

## Cost Comparison

| Task | Cloud Tokens | Local Tokens | Savings |
|---|---|---|---|
| Generate a CRUD service (~200 lines) | ~800 output tokens @ $0.015/1k | 0 (free, on-device) | 100% |
| Generate tests (~300 lines) | ~1,200 output tokens | 0 | 100% |
| Full resource scaffold (8 files) | ~4,000 output tokens | 0 | 100% |
| Planning + review overhead | ~2,000 tokens (still on cloud) | N/A | N/A |

A typical "add a new resource" flow: ~2,000 cloud tokens for orchestration + review, ~4,000 local tokens for generation. vs. ~6,000 cloud tokens without routing. ~65% cost reduction.

## Recommended Models (March 2026)

| Model | VRAM | Best For |
|---|---|---|
| `qwen3-coder:30b` | 16GB+ | General coding, strong tool calling, 256K context |
| `glm-4.7-flash` | 24GB | Best quality on 24GB setups |
| `qwen3-coder:8b` | 8GB | Budget option, still capable for template-following |
| `deepseek-coder-v3:16b` | 12GB | Good balance of size and quality |

## Verification

After any locally-generated code is applied:

```bash
make verify   # lint + typecheck + test — catches anything the local model got wrong
```

If verification fails, the cloud model reviews the error and either fixes it or re-delegates with more specific instructions.
