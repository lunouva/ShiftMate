const baseUrl = String(process.env.MAGIC_VERIFY_BASE_URL || process.env.API_BASE_URL || "http://localhost:4000").trim().replace(/\/$/, "");
const email = String(process.env.MAGIC_VERIFY_EMAIL || process.argv[2] || "").trim();
const redirectUrl = String(process.env.MAGIC_VERIFY_REDIRECT_URL || "https://shiftway.app").trim();
const maxLatencyMs = Number.parseInt(String(process.env.MAGIC_VERIFY_MAX_LATENCY_MS || "3000").trim(), 10) || 3000;

if (!email) {
  console.error("Usage: MAGIC_VERIFY_EMAIL=user@example.com node scripts/verify_magic_request.js");
  process.exit(1);
}

const startedAt = Date.now();
const response = await fetch(`${baseUrl}/api/auth/magic/request`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-request-id": `verify-${Date.now()}`,
  },
  body: JSON.stringify({
    email,
    redirect_url: redirectUrl,
  }),
});
const durationMs = Date.now() - startedAt;
let payload = null;

try {
  payload = await response.json();
} catch {
  payload = null;
}

const result = {
  ok: response.ok,
  status: response.status,
  duration_ms: durationMs,
  max_latency_ms: maxLatencyMs,
  request_id: response.headers.get("x-request-id"),
  body: payload,
};

console.log(JSON.stringify(result));

if (!response.ok) process.exit(1);
if (!payload || payload.ok !== true) process.exit(1);
if (durationMs > maxLatencyMs) process.exit(1);
