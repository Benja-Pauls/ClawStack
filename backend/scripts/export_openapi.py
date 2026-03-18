"""Export the OpenAPI schema to a JSON file without running the server.

Usage:
    cd backend && uv run python scripts/export_openapi.py

Outputs the schema to stdout so it can be piped or redirected.
The Makefile target `make types` uses this to generate frontend types.
"""

from __future__ import annotations

import json

from app.main import create_app

app = create_app()
schema = app.openapi()
print(json.dumps(schema, indent=2))
