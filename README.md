# ShiftMate

Scheduling app with demo mode and a real backend (Node/Express + Postgres).

License: MIT (see `LICENSE`).

## Frontend

```bash
cd /home/kyle/projects/apps/ShiftMate
# Node 20+ recommended (see .nvmrc)
npm ci
cp .env.example .env
npm run dev
```

- Switch Demo/Live mode in **Settings → Backend**.
- In Live mode, the frontend uses `VITE_API_BASE` (defaults to `http://localhost:4000`).

## Backend

Optional: run Postgres locally via Docker:
```bash
docker compose -f server/docker-compose.yml up -d
```

Then:
```bash
cd /home/kyle/projects/apps/ShiftMate/server
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

Server env vars are documented in `server/.env.example`.

## Release checklist

See `docs/release-checklist.md`.

## CI (GitHub Actions)

There’s a ready-to-copy workflow at `docs/github-actions-ci.yml`.

Local CI-like check (frontend build + server install):
```bash
npm run ci
# (alias: npm run check)
```

To enable GitHub Actions CI:
1) Create `.github/workflows/ci.yml` in the repo
2) Copy/paste the contents of `docs/github-actions-ci.yml`

If you see an error like:
> refusing to allow an OAuth App to create or update workflow ... without `workflow` scope

…then create the workflow file via the GitHub web UI (or use a PAT that includes the `workflow` scope).

## Marketing site

Static landing page in `marketing/`. Open `marketing/index.html` in a browser.
