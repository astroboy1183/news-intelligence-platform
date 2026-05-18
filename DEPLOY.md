# Deploy

Single-VM deployment for testing/iteration. Not production-hardened (no backups,
no monitoring, no failover). For a real product, layer those on top.

## Pieces

| What            | Where                              | Cost      |
|-----------------|------------------------------------|-----------|
| Backend + worker + Postgres + Redis | Hetzner CX22 VM   | €4.51/mo  |
| TLS termination | Caddy on the VM (auto Let's Encrypt) | free      |
| Public hostname | DuckDNS (`<name>.duckdns.org`)     | free      |
| Frontend        | Vercel                             | free      |
| Git remote      | GitHub                             | free      |

## One-time setup (~45 min)

### 1. DuckDNS subdomain (free, 2 min)

1. Go to https://www.duckdns.org → log in with GitHub
2. Create a subdomain: e.g. `newsintel-jay.duckdns.org`
3. Leave the IP blank for now — you'll fill it after the VM exists

### 2. Hetzner VM (~5 min)

1. https://console.hetzner.cloud → "New Server"
2. Location: **Falkenstein**
3. Image: **Ubuntu 24.04**
4. Type: **CX22** (€4.51/mo, 4GB RAM, 2 vCPU, 40GB disk)
5. SSH key: upload `~/.ssh/id_ed25519.pub` from your laptop
6. Create. Note the IP (e.g. `65.108.x.x`)
7. Back in DuckDNS, paste this IP into your subdomain → "update ip"

### 3. Bootstrap the VM (~25 min — most of it is the docker build)

```bash
ssh root@65.108.x.x
curl -fsSL https://raw.githubusercontent.com/astroboy1183/news-intelligence-platform/main/scripts/bootstrap.sh | bash
# The script will pause asking you to edit .env. Then:
nano ~/news-intelligence-platform/.env
#   set APP_HOSTNAME=newsintel-jay.duckdns.org
#   set CORS_ORIGINS=https://<your-vercel-url>.vercel.app
#   set POSTGRES_PASSWORD=<random long string>
#   set DATABASE_URL  (replace the password in the connection string)
cd ~/news-intelligence-platform
./scripts/redeploy.sh   # builds image + starts everything
```

When `./scripts/redeploy.sh` finishes:

```bash
curl https://newsintel-jay.duckdns.org/health
# {"status":"ok","database":true}
```

Caddy auto-fetches the Let's Encrypt cert on first request — give it a few seconds.

### 4. Vercel frontend (~5 min)

1. https://vercel.com → "Add New" → "Project"
2. Import your `news-intelligence-platform` repo
3. **Root Directory: `frontend`** ← important
4. Framework auto-detected: Next.js
5. Environment Variables:
    - `NEXT_PUBLIC_API_URL` = `https://newsintel-jay.duckdns.org`
6. Click Deploy. ~3 min later it gives you `https://news-intelligence-<random>.vercel.app`
7. Open it. Dashboard should render with real data from the VM.

### 5. Update CORS to lock down the API

On the VM:

```bash
nano ~/news-intelligence-platform/.env
# set CORS_ORIGINS=https://news-intelligence-<random>.vercel.app
./scripts/redeploy.sh
```

(Re-deploy because the backend caches the parsed list at startup.)

## Iteration loop

```bash
# laptop:
git add . && git commit -m "..." && git push

# VM (ssh root@65.108.x.x):
cd ~/news-intelligence-platform && ./scripts/redeploy.sh
```

That's the full cycle. With BuildKit's layer cache, code-only changes rebuild
in ~30s. pyproject.toml changes trigger the slow pip layer (~5 min). spaCy /
sentence-transformer download layers basically never change.

Vercel auto-deploys frontend on every push to `main`. Nothing to do there.

## Operations

```bash
# tail logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend worker

# psql
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec postgres psql -U nip -d nip

# manual one-off ingest
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python -m flows.ingest

# stop everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# blow it all away (DESTRUCTIVE — drops the DB!)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## Things to know

- **The scheduler runs continuously.** It fires ingest every 2 min. If your VM
  feels overloaded, edit `backend/flows/serve.py` to slow the cron strings
  (e.g. `*/15 * * * *` instead of `*/2`) and run `./scripts/redeploy.sh`.
- **No backups by default.** Set up `pg_dump` to a Cloudflare R2 bucket later.
- **Postgres data lives in the `postgres_data` docker volume.** Don't `docker
  compose down -v` unless you mean it.
- **Caddy gets cert auto.** If DNS doesn't resolve or ports 80/443 aren't open,
  Caddy will keep retrying. Check `docker compose logs caddy` if HTTPS isn't
  working after a few minutes.
