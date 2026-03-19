---
name: Bug report
about: Something isn't working as expected
title: '[bug] '
labels: bug
assignees: ''
---

## Describe the bug

A clear description of what's going wrong.

## Steps to reproduce

1. Run `make dev`
2. Navigate to ...
3. Click on ...
4. See error

## Expected behavior

What you expected to happen.

## Actual behavior

What actually happened. Include error messages, stack traces, or screenshots.

## Environment

- **OS:** (e.g. macOS 15, Ubuntu 24.04)
- **Python version:** (run `python3 --version`)
- **Node version:** (run `node --version`)
- **Docker version:** (run `docker --version`)
- **SerpentStack version / commit:** (run `git rev-parse --short HEAD`)

## Backend logs

Paste relevant structured logs from the FastAPI server (check your terminal after `make dev`):

```json
{ "event": "...", "level": "error", "request_id": "..." }
```

## Additional context

Anything else that might help — recent changes to `.env`, custom configuration, etc.
