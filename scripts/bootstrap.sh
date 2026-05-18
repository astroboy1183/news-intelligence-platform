#!/bin/bash
# Run on a fresh Ubuntu 24.04 VM to bootstrap the platform.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/astroboy1183/news-intelligence-platform/main/scripts/bootstrap.sh | bash
#
# What it does:
#   1. Install Docker + compose plugin
#   2. Clone the repo
#   3. Copy .env.prod.example → .env (you edit it)
#   4. Start everything via docker compose

set -euo pipefail

REPO_URL="https://github.com/astroboy1183/news-intelligence-platform.git"
INSTALL_DIR="$HOME/news-intelligence-platform"

echo "▶ Updating apt..."
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends ca-certificates curl gnupg git

if ! command -v docker >/dev/null 2>&1; then
    echo "▶ Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker "$USER"
    echo "  (you'll need to log out and back in for docker group membership to take effect)"
else
    echo "▶ Docker already installed: $(docker --version)"
fi

if [ ! -d "$INSTALL_DIR" ]; then
    echo "▶ Cloning repo to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "▶ Repo already at $INSTALL_DIR — pulling latest..."
    cd "$INSTALL_DIR"
    git pull --ff-only
fi

cd "$INSTALL_DIR"

if [ ! -f .env ]; then
    echo "▶ Copying .env.prod.example → .env (edit this before continuing!)"
    cp .env.prod.example .env
    echo
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "    Edit ~/news-intelligence-platform/.env now:"
    echo "      - APP_HOSTNAME       (e.g. newsintel-yourname.duckdns.org)"
    echo "      - CORS_ORIGINS       (your Vercel URL)"
    echo "      - POSTGRES_PASSWORD  (anything long + random)"
    echo "      - DATABASE_URL       (use the same password as above)"
    echo "    Then run:    ./scripts/redeploy.sh"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 0
fi

echo "▶ .env exists — building + starting stack..."
DOCKER_BUILDKIT=1 docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "▶ Waiting for Postgres..."
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-nip}" -d "${POSTGRES_DB:-nip}" >/dev/null 2>&1; do
    sleep 1
done

echo "▶ Running migrations + seeds..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python -m app.seed.run_seed

echo
echo "✓ Stack is up. Caddy is fetching a Let's Encrypt cert in the background."
echo "  Health check:    curl https://\$APP_HOSTNAME/health"
echo "  Logs:            docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "  Redeploy:        ./scripts/redeploy.sh"
