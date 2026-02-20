#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

echo "==> Shiftway: local dev setup"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is not installed or not on PATH" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERROR: Node 20+ is required (current: $(node -v)). See .nvmrc" >&2
  exit 1
fi

echo "==> Installing frontend deps (npm ci)"
npm ci

echo "==> Installing server deps (npm ci --prefix server)"
npm --prefix server ci

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
else
  echo "==> .env already exists (leaving as-is)"
fi

if [ ! -f server/.env ]; then
  echo "==> Creating server/.env from server/.env.example"
  cp server/.env.example server/.env
else
  echo "==> server/.env already exists (leaving as-is)"
fi

cat <<'EOF'

Next steps:
  1) Backend (recommended, Live mode):
       docker compose -f server/docker-compose.yml up -d
       npm run server:db:init
       npm run server:dev

  2) Frontend:
       npm run dev

Notes:
  - Live mode is the default; the frontend will call $VITE_API_BASE (default http://localhost:4000).
  - Internal demo mode is gated: set VITE_ENABLE_DEMO=1 and open with ?demo=1.
EOF
