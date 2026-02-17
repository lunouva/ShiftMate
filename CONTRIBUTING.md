# Contributing to Shiftway

Thanks for helping!

## Quick start

### Frontend
```bash
npm ci
cp .env.example .env
npm run dev
```

### Backend (Live mode)
```bash
cd server
npm ci
cp .env.example .env
npm run db:init
npm run dev
```

## Quality gates (before opening a PR)

Run a local CI-like check (frontend build + server install):
```bash
npm run check
```

## CI notes (GitHub Actions)

A ready-to-copy workflow is in `docs/github-actions-ci.yml`.

Note: creating/updating `.github/workflows/*` may require a GitHub token with `workflow` scope.
If you can’t push workflow files from your environment, create the file via the GitHub web UI or use a PAT that includes `workflow` scope.

## Project structure

- `src/` — frontend app
- `server/` — Node/Express backend (Postgres)
- `docs/` — release + CI docs
