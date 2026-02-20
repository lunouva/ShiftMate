# Shiftway — Final Product Agent Prompt (hide demo, ship Live)

## Goal
Shiftway should behave like a **real, shippable scheduling app**, not a demo. Demo mode should be **hidden from normal users** and kept only as an internal/showcase capability for client demos.

## Current repo reality (read before changes)
- Frontend: Vite app in repo root (`src/`, `vite.config.js`)
- Backend: Node/Express + Postgres in `server/`
- README indicates a UI toggle: **Settings → Backend** (Demo/Live).
- Notes/agent learnings live in `.learnings/`.
- There is a `netlify.toml` (likely frontend deploy target).

## Non-goals
- Do **not** add any scheduled/cron jobs until the product is in a stable “final” state and we know what the cron is for.

## Definition of Done (acceptance)
1) **No user-facing Demo switch**
   - Demo/Live toggle removed from the UI.
   - Demo routes/labels not visible in navigation or settings.

2) **Live mode is the default**
   - App boots and expects a backend by default.
   - Sensible empty states + actionable error messages if API is unreachable.

3) **Backend is complete enough to run the product**
   - Server starts reliably with env-driven config.
   - Postgres schema/migrations/seed/init story is clear and repeatable (`npm run db:init` or equivalent).
   - Core flows work end-to-end: auth/session, creating/editing schedules, listing, etc. (Verify what exists and what is missing).

4) **Demo is preserved but gated**
   - Demo remains available only via one of:
     - `VITE_ENABLE_DEMO=1` build-time flag, or
     - a secret URL param + server-provided flag, or
     - a separate “demo” deployment.
   - Default production build has demo disabled.

5) **Release-ready docs**
   - Update `README.md` to reflect production usage (no mention of demo toggle in normal instructions).
   - Add `docs/deploy.md` describing how to deploy frontend + server.

6) **Quality gates**
   - `npm run ci` passes.
   - Server can start + connect to DB locally.

## Work plan
### Phase 1 — Audit
- Search for references to “demo”, “mock”, “fixture”, “seed” in frontend + server.
- Identify the exact code path that selects Demo vs Live.

### Phase 2 — Remove demo from UI
- Delete/disable Settings → Backend toggle.
- Ensure the app chooses Live by default.

### Phase 3 — Harden Live mode
- Ensure API base URL is consistently sourced (e.g., `VITE_API_BASE`).
- Add graceful handling for API errors (401, 403, 5xx, network failure).

### Phase 4 — Backend completeness
- Enumerate existing endpoints + data model.
- Fill missing endpoints required by the frontend.
- Confirm db init/migrations story.

### Phase 5 — Deployment path
- Confirm frontend hosting target (Netlify/Vercel/etc.).
- Choose backend hosting (Render/Fly.io/Railway/DigitalOcean/etc.).
- Add a minimal production config (CORS, session cookie settings, proxy trust, etc.).

### Phase 6 — Only when stable: decide cron
- Clarify what cron is supposed to do (notifications? reminders? cleanup? analytics rollups?).
- Implement the job(s) inside the backend and then schedule in the deployment platform (or Clawdbot Gateway cron) after sign-off.

## Notes / pitfalls
- GitHub Actions workflow pushes may fail due to missing `workflow` OAuth scope (see `.learnings/ERRORS.md`). Create workflows via GitHub UI if needed.

## Commands (local)
```bash
cd /home/kyle/projects/apps/Shiftway
npm run ci

# backend
cd server
npm run db:init
npm run dev
```
