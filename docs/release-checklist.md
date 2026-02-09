# ShiftMate — First Release Checklist

This repo is intentionally lightweight; this checklist is here to make a "v0.1" release repeatable.

## Prereqs
- Node **20+** (see `.nvmrc`)
- Postgres (for Live mode backend)

## Local quality gates (run before tagging)
```bash
npm ci
npm run build
npm --prefix server ci
```

Optional (recommended) smoke checks:
- Frontend demo mode loads and basic navigation works.
- Live mode can:
  - start the server
  - initialize DB
  - log in / create a session (as applicable)

## Backend (Live mode) smoke
```bash
cd server
cp .env.example .env
npm ci
npm run db:init
npm run start
```

## Frontend env sanity
- `VITE_API_BASE` should point at the server (defaults to `http://localhost:4000`).

## Tagging / versioning
- Bump `package.json` version (root) when cutting releases.
- Create a git tag (e.g. `v0.1.0`) on `main`.

## CI
A copy/paste GitHub Actions workflow is available at `docs/github-actions-ci.yml`.

Note: pushing `.github/workflows/*` may require a GitHub token with `workflow` scope.
