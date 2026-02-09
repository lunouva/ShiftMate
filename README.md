# ShiftMate

Scheduling app with demo mode and a real backend (Node/Express + Postgres).

## Frontend

```bash
cd /home/kyle/projects/apps/ShiftMate
npm install
cp .env.example .env
npm run dev
```

- Switch Demo/Live mode in **Settings → Backend**.
- In Live mode, the frontend uses `VITE_API_BASE` (defaults to `http://localhost:4000`).

## Backend

```bash
cd /home/kyle/projects/apps/ShiftMate/server
npm install
cp .env.example .env
npm run db:init
npm run dev
```

## Marketing site

Static landing page in `marketing/`. Open `marketing/index.html` in a browser.
