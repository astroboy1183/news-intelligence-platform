# Deploy on Railway

Railway is a PaaS — no VM, no Caddy, no DNS to configure. Each "service" is a
container with a public HTTPS URL. We'll set up four services:

| Service     | What it is                                          |
|-------------|-----------------------------------------------------|
| Postgres    | Railway-managed DB (pgvector extension supported)   |
| Redis       | Railway-managed Redis                               |
| `backend`   | FastAPI uvicorn, built from `backend/Dockerfile`    |
| `worker`    | Prefect scheduler (same image, different start cmd) |

Frontend stays on Vercel separately. Total cost: ~$5–15/mo after trial credit
runs out, depending on usage.

## Steps

### 1. Sign in
- Go to https://railway.com → **Sign in with GitHub** (no ID, no CC needed for trial)
- New users get a $5 free trial credit; "Hobby" plan is $5/mo and bills only by usage on top of that

### 2. Create a new project
- Click **+ New Project**
- Choose **Deploy from GitHub repo**
- Select `astroboy1183/news-intelligence-platform`
- Railway tries to auto-deploy — **delete that initial deployment** for now (we want to configure services manually)

### 3. Add Postgres
- Project canvas → **+ Create** → **Database** → **Add PostgreSQL**
- Click the Postgres tile → **Variables** tab → confirm it generated `DATABASE_URL`
- Click **Data** tab → **Query** → run:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
  (Our Alembic migration also runs this, but doing it manually now ensures the extension is present before migrations.)

### 4. Add Redis
- **+ Create** → **Database** → **Add Redis**
- It auto-generates `REDIS_URL`

### 5. Add the backend service
- **+ Create** → **GitHub Repo** → select `news-intelligence-platform`
- Click the new service → **Settings** tab:
  - **Root Directory:** `backend`
  - **Builder:** Dockerfile (auto-detected from `backend/Dockerfile`)
  - **Start Command:** leave blank (uses Dockerfile's CMD)
  - **Watch Paths:** `backend/**` (rebuilds only when backend changes)
- **Variables** tab → add:
  - `DATABASE_URL` → click the variable selector → reference `Postgres.DATABASE_URL`
  - `REDIS_URL` → reference `Redis.REDIS_URL`
  - `ENVIRONMENT=prod`
  - `CORS_ORIGINS=*` (we'll lock this down after the frontend is up)
- **Settings** → **Networking** → click **Generate Domain**. You get something like
  `news-intelligence-platform-production.up.railway.app`. **Note that URL.**
- Click **Deploy**. First build takes ~10–15 min (pip + sentence-transformers + spaCy model downloads).

### 6. Run the initial migrations + seed (one-time)
- Once the backend deploy is healthy, open it → **⋯** menu → **Terminal**
- Inside:
  ```bash
  alembic upgrade head
  python -m app.seed.run_seed
  ```

### 7. Add the worker service
- **+ Create** → **GitHub Repo** → same repo
- **Settings**:
  - **Root Directory:** `backend`
  - **Builder:** Dockerfile
  - **Start Command:** `python -m flows.serve`  ← key difference
  - Disable **Public Networking** (worker is internal-only — saves billing on egress)
- **Variables** → same as backend: `DATABASE_URL`, `REDIS_URL`, `ENVIRONMENT=prod`
- Deploy. Reuses the cached image so this is fast (~30s).

### 8. Verify
```bash
curl https://<your-railway-domain>/health
# {"status":"ok","database":true}

curl https://<your-railway-domain>/ingestion/summary
# {"runs_last_hour":..., "articles_inserted_24h":..., ...}
```

### 9. Frontend on Vercel (~5 min)
1. https://vercel.com → **Add New** → **Project** → import the same GitHub repo
2. **Root Directory:** `frontend`
3. Env Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<your-railway-domain>`
4. Deploy.

### 10. Lock CORS
Back on the Railway `backend` service → **Variables**:
- Change `CORS_ORIGINS` from `*` to your Vercel URL: `https://news-intelligence-platform.vercel.app`
- Railway will redeploy automatically (~1 min)

## Iteration loop

```bash
# laptop
git add . && git commit -m "..." && git push
# Railway watches the repo and redeploys automatically on push to main (~3 min per change)
# Vercel does the same for the frontend
```

No SSH, no scripts, no DNS. Just push.

## What might trip you up

- **Build runs out of memory** — Railway free build pods are 4GB; the torch+sentence-transformers install can spike. If it OOMs, upgrade to the $5 Hobby plan which uses bigger build pods. Build success rate jumps from ~50% to ~99%.
- **`pgvector` extension missing** — the manual `CREATE EXTENSION vector` in step 3 prevents this. If you skipped it, run it in the Postgres → Data tab.
- **`DATABASE_URL` rejected as `postgresql://...`** — `app/core/config.py` auto-coerces this to `postgresql+asyncpg://...`. No action needed.
- **Cost runs hot** — the worker is the biggest spend (always running, periodic ML model loads). To save: bump the cron in `flows/serve.py` to `*/15` or `*/30`, or stop the worker entirely and trigger ingestion manually via the dashboard's "Run ingestion now" button.

## Switching back to a VM later

The Hetzner-style files (`docker-compose.prod.yml`, `Caddyfile`, `scripts/bootstrap.sh`,
`DEPLOY.md`) are still in the repo and unchanged. If Railway gets expensive,
you can switch to a $4-5/mo Hetzner / DigitalOcean VM with no code changes —
just run `bootstrap.sh` on the new VM.
