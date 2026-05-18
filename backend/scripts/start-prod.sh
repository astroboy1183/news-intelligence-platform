#!/bin/sh
# Production entrypoint: runs both the FastAPI server and the Prefect
# scheduler inside one container. The scheduler runs in the background;
# uvicorn runs in the foreground (so the container's lifetime is tied to
# the API process, which is what we want).
#
# Why one container instead of two services on Railway:
#   - simpler ops (one image to redeploy, one set of env vars)
#   - cheaper (no second service billing)
#   - sentence-transformers is already loaded in the API process via
#     the embedding endpoints, so loading it again in a worker is
#     mostly wasted RAM
#
# Disable the scheduler by setting RUN_SCHEDULER=false in env vars.

set -e

if [ "${RUN_SCHEDULER:-true}" = "true" ]; then
    echo "▶ Starting Prefect scheduler in background"
    python -m flows.serve &
else
    echo "▶ Scheduler disabled via RUN_SCHEDULER=false"
fi

echo "▶ Starting uvicorn on 0.0.0.0:${PORT:-8000}"
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
