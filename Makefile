.PHONY: help up down down-volumes logs ps psql redis-cli minio-console prefect-ui \
        backend-install backend-dev backend-shell migrate revision test lint format

help:
	@echo "Common commands:"
	@echo "  make up              - Start all docker services (Postgres, Redis, MinIO, Prefect)"
	@echo "  make down            - Stop docker services"
	@echo "  make down-volumes    - Stop and remove all data volumes (DANGER)"
	@echo "  make logs            - Tail docker logs"
	@echo "  make ps              - List running containers"
	@echo "  make psql            - Open psql shell on the Postgres container"
	@echo "  make redis-cli       - Open redis-cli on the Redis container"
	@echo "  make backend-install - Install backend Python deps (requires venv active)"
	@echo "  make backend-dev     - Run FastAPI with --reload"
	@echo "  make migrate         - Run alembic upgrade head"
	@echo "  make revision m=msg  - Create a new alembic migration"
	@echo "  make test            - Run backend pytest"
	@echo "  make lint            - Run ruff + mypy"
	@echo "  make format          - Run ruff format"

# --- Docker ---
up:
	docker compose up -d

down:
	docker compose down

down-volumes:
	docker compose down -v

logs:
	docker compose logs -f

ps:
	docker compose ps

psql:
	docker compose exec postgres psql -U $${POSTGRES_USER:-nip} -d $${POSTGRES_DB:-nip}

redis-cli:
	docker compose exec redis redis-cli

minio-console:
	@echo "Open http://localhost:9001 (user: minioadmin, pass: minioadmin)"

prefect-ui:
	@echo "Open http://localhost:4200"

# --- Backend ---
backend-install:
	cd backend && pip install -e ".[dev]" && python -m spacy download en_core_web_sm

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

migrate:
	cd backend && .venv/bin/alembic upgrade head

revision:
	cd backend && .venv/bin/alembic revision --autogenerate -m "$(m)"

seed:
	cd backend && .venv/bin/python -m app.seed.run_seed

ingest:
	cd backend && .venv/bin/python -m flows.ingest

enrich:
	cd backend && .venv/bin/python -m flows.enrich

cluster:
	cd backend && .venv/bin/python -m flows.cluster

build-stories:
	cd backend && .venv/bin/python -m flows.build_stories

pipeline:
	cd backend && .venv/bin/python -m flows.ingest && \
	.venv/bin/python -m flows.enrich && \
	.venv/bin/python -m flows.cluster && \
	.venv/bin/python -m flows.build_stories && \
	.venv/bin/python -m flows.intelligence

intelligence:
	cd backend && .venv/bin/python -m flows.intelligence

serve:
	cd backend && .venv/bin/python -m flows.serve

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && pytest -q

lint:
	cd backend && ruff check . && mypy app

format:
	cd backend && ruff format . && ruff check --fix .
