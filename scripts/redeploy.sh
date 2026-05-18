#!/bin/bash
# Iteration loop: pull latest, rebuild backend image, restart containers.
# Run this on the VM whenever you push new code to GitHub.
#
# Usage on the VM:
#   cd ~/news-intelligence-platform && ./scripts/redeploy.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "▶ git pull..."
git pull --ff-only

echo "▶ Rebuilding backend image (BuildKit cached, code-only changes are fast)..."
DOCKER_BUILDKIT=1 docker compose -f docker-compose.yml -f docker-compose.prod.yml build backend

echo "▶ Restarting backend + worker with the new image..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps backend worker

echo "▶ Running any new migrations..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head

echo "▶ Tailing recent logs..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 backend worker
