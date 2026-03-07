# ShiftWay Deployment Guide

ShiftWay uses a multi-tenant architecture where the frontend serves both the marketing site (root domain) and the workspace application (subdomains) from a single codebase.

## 🌍 Environment Variables

### Frontend (Netlify)
These must be set in Netlify Site Settings > Environment Variables.

| Variable | Value (Example) | Description |
|----------|-----------------|-------------|
| `VITE_APP_DOMAIN` | `shiftway.app` | The production root domain. Used to detect subdomains. |
| `VITE_API_BASE` | `https://api-production-bdb9.up.railway.app` | URL of the backend API. |
| `VITE_ENABLE_DEMO` | `0` | Set to `0` for production to disable demo mode/data. |

### Backend (Railway)
Ensure these are set in your Railway project.

| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Base URL for CORS (e.g. `https://shiftway.app`). |
| `STRIPE_SECRET_KEY` | Stripe Secret Key (`sk_live_...`). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint. |
| `DATABASE_URL` | Postgres connection string. |

## 📡 DNS & Domain Configuration

### 1. Wildcard DNS
To support dynamic workspaces (e.g. `cold-stone.shiftway.app`), you must configure a wildcard DNS record.

*   **Type:** `CNAME`
*   **Name:** `*`
*   **Value:** `shiftway.netlify.app` (or your Netlify site URL)

### 2. Netlify Domain Settings
1.  Go to **Domain Management**.
2.  Add your primary domain (`shiftway.app`).
3.  Add the wildcard domain as a **Domain Alias**: `*.shiftway.app`.

## 💳 Stripe Configuration

You must configure Stripe Redirects and Webhooks to match your production domain.

### Redirect URLs
Update your backend code or environment config if hardcoded, but generally the frontend sends these during checkout creation:
*   Success: `https://shiftway.app/billing/success`
*   Cancel: `https://shiftway.app/billing/cancel`

### Webhook
Point Stripe webhooks to:
`https://api-production-bdb9.up.railway.app/api/billing/webhook`

Events to listen for:
*   `checkout.session.completed`
*   `customer.subscription.updated`
*   `customer.subscription.deleted`

## 🛠 Local Development

### Subdomain Testing
Localhost doesn't support subdomains easily (e.g. `test.localhost` works in some browsers but is flaky).

**The Fallback Method:**
ShiftWay supports a query parameter fallback for development.

*   **Root Site:** `http://localhost:5173`
*   **Workspace:** `http://localhost:5173/?org=my-slug`

The app will detect the `?org=` param and treat it exactly like a subdomain, injecting the `X-Org-Slug` header into API requests automatically.

### Running Locally
1.  **Backend:** `npm run server:dev` (runs on port 4000)
2.  **Frontend:** `npm run dev` (runs on port 5173)
