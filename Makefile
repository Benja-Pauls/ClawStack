.PHONY: init dev dev-docker test test-backend test-frontend migrate migrate-new build lint clean setup deploy-init deploy types seed worker ui verify persistent

init:
	python3 scripts/init.py

dev:
	docker compose up -d postgres redis
	@echo "Waiting for postgres..."
	@until docker compose exec postgres pg_isready > /dev/null 2>&1; do sleep 1; done
	@echo "Running migrations..."
	cd backend && uv run alembic upgrade head
	@echo "Postgres ready. Starting backend and frontend..."
	$(MAKE) -j2 _dev-backend _dev-frontend

_dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

_dev-frontend:
	cd frontend && npm run dev

dev-docker:
	docker compose up --build

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm test

migrate:
	cd backend && uv run alembic upgrade head

migrate-new:
	cd backend && uv run alembic revision --autogenerate -m "$(name)"

build:
	docker compose build

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint

clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.venv frontend/node_modules

setup:
	cd backend && uv sync
	cd frontend && npm install
	@cp -n .env.example .env 2>/dev/null || true
	@echo "Setup complete. Edit .env if needed, then run 'make dev'"

deploy-init:
	./scripts/deploy-init.sh

deploy:
	./scripts/deploy.sh $(env)

seed:
	cd backend && uv run python -m app.cli.seed

worker:
	cd backend && uv run arq app.worker.settings.WorkerSettings

ui:
	@cd frontend && npx shadcn@latest add $(component)

verify:
	@echo "── Lint (backend) ──"
	cd backend && uv run ruff check . && uv run ruff format --check .
	@echo "── Lint (frontend) ──"
	cd frontend && npm run lint
	@echo "── Type check (frontend) ──"
	cd frontend && npx tsc --noEmit
	@echo "── Tests (backend) ──"
	cd backend && uv run pytest --tb=short -q
	@echo "── Tests (frontend) ──"
	cd frontend && npm test
	@echo ""
	@echo "✅ All checks passed."

types:
	@echo "Generating TypeScript types from OpenAPI spec..."
	@cd backend && uv run python scripts/export_openapi.py > ../frontend/src/types/openapi.json
	@cd frontend && ./node_modules/.bin/openapi-typescript src/types/openapi.json -o src/types/api.generated.ts
	@rm -f frontend/src/types/openapi.json
	@echo "Types written to frontend/src/types/api.generated.ts"

persistent:
	@echo "── Setting up persistent agent (OpenClaw) ──"
	@if ! command -v openclaw >/dev/null 2>&1; then \
		echo "OpenClaw not found. Installing..."; \
		npm install -g openclaw@latest; \
	fi
	@echo "Starting persistent agent with project workspace..."
	@echo "  SOUL.md:      .openclaw/SOUL.md"
	@echo "  HEARTBEAT.md: .openclaw/HEARTBEAT.md"
	@echo "  AGENTS.md:    .openclaw/AGENTS.md"
	@echo ""
	openclaw start --workspace .openclaw/
