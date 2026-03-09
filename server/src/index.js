import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import nodemailer from "nodemailer";
import twilio from "twilio";
import webpush from "web-push";
import Stripe from "stripe";
import pool, { query } from "./db.js";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret") {
    throw new Error("Missing JWT_SECRET (or using insecure default). Set JWT_SECRET in server/.env.");
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "dev-session") {
    throw new Error("Missing SESSION_SECRET (or using insecure default). Set SESSION_SECRET in server/.env.");
  }
} else {
  if (!process.env.JWT_SECRET) console.warn("[shiftway-server] JWT_SECRET not set; using dev default");
  if (!process.env.SESSION_SECRET) console.warn("[shiftway-server] SESSION_SECRET not set; using dev default");
}

const app = express();
const PORT = process.env.PORT || 4000;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

const normalizeOrigin = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    return new URL(v).origin.toLowerCase();
  } catch {
    return v.replace(/\/$/, "").toLowerCase();
  }
};

const APP_ALLOWED_ORIGINS = new Set(
  [
    APP_URL,
    ...(process.env.APP_ALLOWED_ORIGINS || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
);
const allowedWebOrigins = Array.from(APP_ALLOWED_ORIGINS.values());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session";

// ── SaaS / Billing ──────────────────────────────────────────────────────────
const SAAS_DOMAIN = (process.env.SAAS_DOMAIN || "").replace(/^\./, "");
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || "14", 10);

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

if (isProd && !stripe) {
  console.warn("[shiftway-server] STRIPE_SECRET_KEY not set — billing features disabled");
}

// Express 4 does not natively forward rejected promises from async handlers.
// Wrap route handlers so async throw/rejections are consistently surfaced.
const wrapAsync = (handler) => {
  if (typeof handler !== "function") return handler;
  if (handler.length === 4) return handler; // keep error middleware untouched
  return (req, res, next) => {
    try {
      const out = handler(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };
};

for (const method of ["get", "post", "put", "patch", "delete"]) {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) => original(path, ...handlers.map(wrapAsync));
}

const normalizeEmailInput = (value) => String(value || "").trim().toLowerCase();
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const parsePositiveIntEnv = (name, fallback) => {
  const value = Number.parseInt(String(process.env[name] || "").trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const serializeError = (err) => {
  if (!err) return null;
  return {
    name: err.name || "Error",
    message: err.message || String(err),
    code: err.code || null,
    response_code: err.responseCode || null,
    command: err.command || null,
  };
};
const maskEmailAddress = (value) => {
  const normalized = normalizeEmailInput(value);
  if (!normalized.includes("@")) return normalized ? "***" : "";
  const [localPart, domainPart] = normalized.split("@");
  const safeLocal = localPart.length <= 2
    ? `${localPart.slice(0, 1)}***`
    : `${localPart.slice(0, 2)}***`;
  return `${safeLocal}@${domainPart}`;
};
const logStructured = (level, event, fields = {}) => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};
const rateLimitHandler = (req, res) => res.status(429).json({ error: "too_many_requests" });
const buildRateLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

const authRateLimiter = buildRateLimiter(15 * 60 * 1000, 10);
const inviteRateLimiter = buildRateLimiter(60 * 60 * 1000, 20);
const generalApiRateLimiter = buildRateLimiter(60 * 1000, 200);
const publicSignupRateLimiter = buildRateLimiter(15 * 60 * 1000, 15);
const publicSlugCheckRateLimiter = buildRateLimiter(60 * 1000, 60);
const billingRateLimiter = buildRateLimiter(15 * 60 * 1000, 60);
const magicVerifyRateLimiter = buildRateLimiter(15 * 60 * 1000, 30);
const SMTP_CONNECTION_TIMEOUT_MS = parsePositiveIntEnv("SMTP_CONNECTION_TIMEOUT_MS", 5000);
const SMTP_GREETING_TIMEOUT_MS = parsePositiveIntEnv("SMTP_GREETING_TIMEOUT_MS", 5000);
const SMTP_SOCKET_TIMEOUT_MS = parsePositiveIntEnv("SMTP_SOCKET_TIMEOUT_MS", 15000);
const SMTP_SEND_TIMEOUT_MS = parsePositiveIntEnv("SMTP_SEND_TIMEOUT_MS", 8000);

// Check whether an origin matches the configured SAAS_DOMAIN wildcard (*.shiftway.app)
const isSubdomainOrigin = (origin) => {
  if (!SAAS_DOMAIN || !origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(`.${SAAS_DOMAIN}`) || hostname === SAAS_DOMAIN;
  } catch {
    return false;
  }
};

const isAllowedRedirectUrl = (candidate) => {
  const value = String(candidate || "").trim();
  if (!value) return false;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const origin = normalizeOrigin(parsed.origin);
    return APP_ALLOWED_ORIGINS.has(origin) || isSubdomainOrigin(parsed.origin);
  } catch {
    return false;
  }
};

const resolveSafeRedirectUrl = (candidate, fallbackUrl = APP_URL) => {
  const fallback = isAllowedRedirectUrl(fallbackUrl) ? fallbackUrl : APP_URL;
  const fallbackOrigin = new URL(fallback).origin;
  const value = String(candidate || "").trim();
  if (!value) return fallback;

  if (value.startsWith("/")) {
    try {
      return new URL(value, `${fallbackOrigin}/`).toString();
    } catch {
      return fallback;
    }
  }

  return isAllowedRedirectUrl(value) ? value : fallback;
};

app.use(cors({
  origin: isProd
    ? (origin, cb) => {
        // Allow non-browser requests (no Origin header) and explicitly configured web origins.
        if (!origin) return cb(null, true);
        const normalizedOrigin = normalizeOrigin(origin);
        if (APP_ALLOWED_ORIGINS.has(normalizedOrigin)) return cb(null, true);
        // Allow any subdomain of SAAS_DOMAIN (e.g. *.shiftway.app)
        if (isSubdomainOrigin(origin)) return cb(null, true);
        return cb(new Error("origin_not_allowed"));
      }
    : true,
  credentials: true,
}));
// Stripe webhook needs raw body — must be registered BEFORE express.json()
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "billing_not_configured" });

    const sig = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: "webhook_secret_not_configured" });

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: "invalid_signature" });
    }

    try {
      await handleStripeEvent(event);
    } catch (err) {
      console.error("[stripe-webhook] Handler error:", err);
      return res.status(500).json({ error: "webhook_handler_error" });
    }

    res.json({ received: true });
  }
);

app.use(express.json({ limit: "2mb" }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", ...allowedWebOrigins],
      formAction: ["'self'", ...allowedWebOrigins],
      frameAncestors: ["'self'", ...allowedWebOrigins],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use((req, res, next) => {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

if (isProd) {
  // Needed for secure cookies behind typical reverse proxies (Render/Fly/Heroku/Nginx).
  // Allow override for multi-hop proxy setups (e.g., Cloudflare -> Render).
  app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
}

app.use("/api", generalApiRateLimiter);
app.use("/api/invite", inviteRateLimiter);
app.use("/api/billing", billingRateLimiter);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: "lax",
    secure: isProd,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    passReqToCallback: true,
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${APP_URL}/api/auth/google/callback`,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = normalizeEmailInput(profile.emails?.[0]?.value);
      if (!email) return done(new Error("No email from Google"));
      const pendingInviteToken = String(req.session?.google_oauth?.invite_token || "").trim();

      if (pendingInviteToken) {
        const client = pool ? await pool.connect() : null;
        if (!client) throw new Error("Missing DATABASE_URL");
        try {
          await client.query("BEGIN");
          const inviteRes = await client.query("SELECT * FROM invites WHERE token = $1 FOR UPDATE", [pendingInviteToken]);
          const invite = inviteRes.rows[0];
          if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
            throw createFlowError("invalid_invite");
          }

          const { user } = await acceptInviteWithIdentity(client, invite, {
            email,
            fullName: String(profile.displayName || invite.full_name || "").trim(),
            passwordHash: null,
          });
          await client.query("COMMIT");
          client.release();
          return done(null, user);
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          client.release();
          return done(err);
        }
      }

      const existing = await query("SELECT * FROM users WHERE email = $1", [email]);
      if (existing.rows[0]) return done(null, existing.rows[0]);
      const googleOrgSlug = `workspace-${crypto.randomBytes(4).toString("hex")}`;
      const org = await query("INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING *", ["New Company", googleOrgSlug]);
      const location = await query("INSERT INTO locations (org_id, name) VALUES ($1, $2) RETURNING *", [org.rows[0].id, "Main Location"]);
      const user = await query(
        "INSERT INTO users (org_id, location_id, full_name, email, role, is_active) VALUES ($1,$2,$3,$4,$5,true) RETURNING *",
        [org.rows[0].id, location.rows[0].id, profile.displayName || "Owner", email, "owner"]
      );
      await ensureOrgState(org.rows[0].id, location.rows[0].id, user.rows[0]);
      done(null, user.rows[0]);
    } catch (err) {
      done(err);
    }
  }));
}

const signToken = (user) => jwt.sign({ userId: user.id, orgId: user.org_id }, JWT_SECRET, { expiresIn: "7d" });

const auth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userRes = await query("SELECT * FROM users WHERE id = $1", [payload.userId]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: "invalid_user" });
    req.user = user;
    next();
  } catch (err) {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({ error: "token_expired" });
    }
    res.status(401).json({ error: "invalid_token" });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
};

// ── Subdomain → Org slug resolution ─────────────────────────────────────────
// Extracts the workspace slug from:
//   1. Host header: coldstone.shiftway.app → "coldstone"
//   2. X-Org-Slug header (dev/testing fallback)
// Attaches resolved org to req.org.
const resolveOrgBySlug = async (req, res, next) => {
  // Dev override: pass X-Org-Slug header when running locally without real DNS
  let slug = req.headers["x-org-slug"] || null;

  if (!slug && SAAS_DOMAIN) {
    const host = (req.headers.host || "").split(":")[0];
    if (host.endsWith(`.${SAAS_DOMAIN}`)) {
      slug = host.slice(0, -(SAAS_DOMAIN.length + 1));
    }
  }

  if (!slug) return next(); // not a subdomain request — skip

  const orgRes = await query("SELECT * FROM orgs WHERE slug = $1", [slug]);
  if (!orgRes.rows[0]) return res.status(404).json({ error: "workspace_not_found" });
  req.org = orgRes.rows[0];
  next();
};

// ── Subscription enforcement ──────────────────────────────────────────────────
// Gates routes behind an active or trialing subscription.
// Apply after `auth` on any route that should be billing-gated.
const requireActiveSubscription = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "missing_token" });

  const subRes = await query(
    "SELECT status, trial_ends_at, current_period_end FROM subscriptions WHERE org_id = $1",
    [req.user.org_id]
  );
  const sub = subRes.rows[0];

  if (!sub) {
    // No subscription row at all — org was created before billing was wired up.
    // Grant access (legacy orgs) but emit a warning for ops visibility.
    console.warn(`[billing] org ${req.user.org_id} has no subscription row — allowing legacy access`);
    return next();
  }

  if (sub.status === "active" || sub.status === "trialing") return next();

  return res.status(402).json({
    error: "billing_required",
    status: sub.status,
    message: "Your subscription is inactive. Please update your billing information.",
  });
};

// ── Stripe helpers ─────────────────────────────────────────────────────────
const upsertSubscription = async (orgId, fields) => {
  const {
    stripeCustomerId,
    stripeSubscriptionId,
    status,
    plan,
    trialEndsAt,
    currentPeriodEnd,
  } = fields;

  await query(
    `INSERT INTO subscriptions
       (org_id, stripe_customer_id, stripe_subscription_id, status, plan, trial_ends_at, current_period_end, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (org_id) DO UPDATE SET
       stripe_customer_id     = COALESCE(EXCLUDED.stripe_customer_id,     subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       status                 = EXCLUDED.status,
       plan                   = COALESCE(EXCLUDED.plan,                    subscriptions.plan),
       trial_ends_at          = COALESCE(EXCLUDED.trial_ends_at,           subscriptions.trial_ends_at),
       current_period_end     = COALESCE(EXCLUDED.current_period_end,      subscriptions.current_period_end),
       updated_at             = now()`,
    [
      orgId,
      stripeCustomerId || null,
      stripeSubscriptionId || null,
      status,
      plan || null,
      trialEndsAt ? new Date(trialEndsAt * 1000) : null,
      currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
    ]
  );
};

const getOrgByStripeCustomerId = async (customerId) => {
  const res = await query(
    "SELECT org_id FROM subscriptions WHERE stripe_customer_id = $1",
    [customerId]
  );
  return res.rows[0]?.org_id || null;
};

const handleStripeEvent = async (event) => {
  const { type, data } = event;
  const obj = data.object;

  switch (type) {
    case "checkout.session.completed": {
      // Link the Stripe customer to the org and set subscription to active/trialing
      const orgId = obj.metadata?.org_id;
      if (!orgId) {
        console.warn("[stripe-webhook] checkout.session.completed missing org_id metadata");
        return;
      }
      await upsertSubscription(orgId, {
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: obj.subscription,
        status: "active",
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const orgId = await getOrgByStripeCustomerId(obj.customer);
      if (!orgId) {
        console.warn(`[stripe-webhook] ${type} — no org found for customer ${obj.customer}`);
        return;
      }
      await upsertSubscription(orgId, {
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: obj.id,
        status: obj.status,
        plan: obj.items?.data?.[0]?.price?.id || null,
        trialEndsAt: obj.trial_end,
        currentPeriodEnd: obj.current_period_end,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const orgId = await getOrgByStripeCustomerId(obj.customer);
      if (!orgId) return;
      await upsertSubscription(orgId, {
        stripeCustomerId: obj.customer,
        stripeSubscriptionId: obj.id,
        status: "canceled",
        currentPeriodEnd: obj.current_period_end,
      });
      break;
    }

    case "invoice.paid": {
      const orgId = await getOrgByStripeCustomerId(obj.customer);
      if (!orgId) return;
      await upsertSubscription(orgId, {
        stripeCustomerId: obj.customer,
        status: "active",
        currentPeriodEnd: obj.lines?.data?.[0]?.period?.end || null,
      });
      break;
    }

    case "invoice.payment_failed": {
      const orgId = await getOrgByStripeCustomerId(obj.customer);
      if (!orgId) return;
      await upsertSubscription(orgId, {
        stripeCustomerId: obj.customer,
        status: "past_due",
      });
      break;
    }

    default:
      // Unhandled event — silently ignore
      break;
  }
};

// ── Slug utilities ────────────────────────────────────────────────────────────
const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";

const isValidSlug = (slug) => /^[a-z0-9][a-z0-9-]{1,47}$/.test(slug);
const RESERVED_SLUGS = new Set(["api", "www", "admin", "app", "billing", "support", "help"]);
const isReservedSlug = (slug) => RESERVED_SLUGS.has(String(slug || "").trim().toLowerCase());

const ORG_STATE_KEYS = new Set([
  "locations",
  "positions",
  "users",
  "schedules",
  "time_off_requests",
  "unavailability",
  "news_posts",
  "tasks",
  "task_templates",
  "messages",
  "shift_swaps",
  "open_shift_claims",
  "notification_settings",
  "feature_flags",
]);

const isPlainObject = (value) => (
  value != null
  && typeof value === "object"
  && !Array.isArray(value)
);

const validateOrgStatePayload = (data) => {
  if (!isPlainObject(data)) return { ok: false, error: "invalid_state_payload" };
  const keys = Object.keys(data);
  if (keys.some((key) => !ORG_STATE_KEYS.has(key))) {
    return { ok: false, error: "invalid_state_keys" };
  }

  const arrayKeys = [
    "locations",
    "positions",
    "users",
    "schedules",
    "time_off_requests",
    "unavailability",
    "news_posts",
    "tasks",
    "task_templates",
    "messages",
    "shift_swaps",
    "open_shift_claims",
  ];

  for (const key of arrayKeys) {
    if (hasOwn(data, key) && !Array.isArray(data[key])) {
      return { ok: false, error: "invalid_state_payload" };
    }
  }

  if (hasOwn(data, "notification_settings") && !isPlainObject(data.notification_settings)) {
    return { ok: false, error: "invalid_state_payload" };
  }
  if (hasOwn(data, "feature_flags") && !isPlainObject(data.feature_flags)) {
    return { ok: false, error: "invalid_state_payload" };
  }

  return { ok: true };
};

const defaultFlags = () => ({
  unavailabilityEnabled: true,
  employeeEditUnavailability: true,
  showTimeOffOnSchedule: true,
  newsfeedEnabled: true,
  employeesCanPostToFeed: false,
  tasksEnabled: true,
  messagesEnabled: true,
  swapsEnabled: true,
  weekStartsOn: 1,
});

const seedState = ({ locationId, ownerUser }) => ({
  locations: [{ id: locationId, name: "Main Location" }],
  positions: [
    { id: crypto.randomUUID(), location_id: locationId, name: "Shift Lead" },
    { id: crypto.randomUUID(), location_id: locationId, name: "Manager" },
    { id: crypto.randomUUID(), location_id: locationId, name: "Staff" },
  ],
  users: [
    {
      id: ownerUser.id,
      location_id: locationId,
      full_name: ownerUser.full_name,
      email: ownerUser.email,
      role: ownerUser.role,
      is_active: true,
      phone: "",
      birthday: "",
      pronouns: "",
      emergency_contact: { name: "", phone: "" },
      attachments: [],
      notes: "",
      wage: "",
    },
  ],
  schedules: [],
  time_off_requests: [],
  unavailability: [],
  news_posts: [],
  tasks: [],
  task_templates: [],
  messages: [],
  shift_swaps: [],
  open_shift_claims: [],
  notification_settings: { email: true, sms: false, push: false },
  feature_flags: defaultFlags(),
});

const ensureOrgState = async (orgId, locationId, ownerUser) => {
  const stateRes = await query("SELECT data FROM org_state WHERE org_id = $1", [orgId]);
  if (stateRes.rows[0]) return stateRes.rows[0].data;
  const data = seedState({ locationId, ownerUser });
  await query("INSERT INTO org_state (org_id, data) VALUES ($1, $2)", [orgId, data]);
  return data;
};

const mailer = (() => {
  if (!process.env.SMTP_URL) return null;
  return nodemailer.createTransport({
    url: process.env.SMTP_URL,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
})();

let lastEmailDeliveryDebug = null;

const smsClient = (() => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
})();

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@shiftway.local",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const sendEmail = async ({
  to,
  subject,
  text,
  correlationId = null,
  emailType = "transactional",
  timeoutMs = SMTP_SEND_TIMEOUT_MS,
}) => {
  const logContext = {
    correlation_id: correlationId || crypto.randomUUID(),
    email_type: emailType,
    timeout_ms: timeoutMs,
    to: maskEmailAddress(to),
  };

  if (!mailer || !process.env.EMAIL_FROM) {
    const err = new Error("SMTP transport not configured");
    err.code = "smtp_not_configured";
    const failureDebug = {
      at: new Date().toISOString(),
      request_id: logContext.correlation_id,
      type: emailType,
      to: maskEmailAddress(to),
      accepted: [],
      rejected: [],
      response: null,
      message_id: null,
      duration_ms: 0,
      ok: false,
      error: serializeError(err),
    };
    lastEmailDeliveryDebug = failureDebug;
    logStructured("warn", "email.failure", {
      ...logContext,
      duration_ms: 0,
      error: serializeError(err),
    });
    return false;
  }

  const startedAt = Date.now();
  let timer = null;
  logStructured("info", "email.attempt", logContext);

  try {
    const info = await Promise.race([
      mailer.sendMail({ from: process.env.EMAIL_FROM, to, subject, text }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error(`SMTP send timed out after ${timeoutMs}ms`);
          err.code = "smtp_send_timeout";
          reject(err);
        }, timeoutMs);
      }),
    ]);
    const successDebug = {
      at: new Date().toISOString(),
      request_id: logContext.correlation_id,
      type: emailType,
      to: maskEmailAddress(to),
      accepted: Array.isArray(info?.accepted) ? info.accepted : [],
      rejected: Array.isArray(info?.rejected) ? info.rejected : [],
      response: info?.response || null,
      message_id: info?.messageId || null,
      duration_ms: Date.now() - startedAt,
      ok: true,
      error: null,
    };
    lastEmailDeliveryDebug = successDebug;
    logStructured("info", "email.success", {
      ...logContext,
      duration_ms: successDebug.duration_ms,
      message_id: successDebug.message_id,
      accepted_count: successDebug.accepted.length,
      rejected_count: successDebug.rejected.length,
      response: successDebug.response,
    });
    return true;
  } catch (err) {
    const failureDebug = {
      at: new Date().toISOString(),
      request_id: logContext.correlation_id,
      type: emailType,
      to: maskEmailAddress(to),
      accepted: [],
      rejected: [],
      response: err?.response || null,
      message_id: null,
      duration_ms: Date.now() - startedAt,
      ok: false,
      error: serializeError(err),
    };
    lastEmailDeliveryDebug = failureDebug;
    logStructured("error", "email.failure", {
      ...logContext,
      duration_ms: failureDebug.duration_ms,
      response: failureDebug.response,
      error: failureDebug.error,
    });
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const sendEmailInBackground = (options) => {
  setImmediate(() => {
    void sendEmail(options).catch(() => {});
  });
};

const sendSms = async ({ to, body }) => {
  if (!smsClient || !process.env.TWILIO_FROM) return false;
  const sender = String(process.env.TWILIO_FROM || "").trim();
  const senderConfig = /^MG[0-9a-f]{32}$/i.test(sender)
    ? { messagingServiceSid: sender }
    : { from: sender };
  await smsClient.messages.create({ to, body, ...senderConfig });
  return true;
};

const sendPush = async ({ subscriptions, title, body }) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  const payload = JSON.stringify({ title, body, url: APP_URL });
  await Promise.all(subscriptions.map((sub) => webpush.sendNotification(sub, payload).catch(() => null)));
  return true;
};

const emptyOrgState = () => ({
  locations: [],
  positions: [],
  users: [],
  schedules: [],
  time_off_requests: [],
  unavailability: [],
  news_posts: [],
  tasks: [],
  task_templates: [],
  messages: [],
  shift_swaps: [],
  open_shift_claims: [],
  notification_settings: { email: true, sms: false, push: false },
  feature_flags: defaultFlags(),
});

function createFlowError(code, message = code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function appendErrorToRedirectUrl(target, code) {
  const safeTarget = resolveSafeRedirectUrl(target, APP_URL);
  const url = new URL(safeTarget);
  url.searchParams.set("error", String(code || "google_auth_failed"));
  return url.toString();
}

async function acceptInviteWithIdentity(client, invite, { email, fullName, passwordHash = null }) {
  const inviteEmail = normalizeEmailInput(invite.email);
  const normalizedEmail = normalizeEmailInput(email || invite.email || "");
  if (inviteEmail && normalizedEmail !== inviteEmail) {
    throw createFlowError("invite_email_mismatch");
  }
  if (!inviteEmail && !passwordHash) {
    throw createFlowError("invite_requires_password");
  }

  const fallbackEmail = `invite+${invite.id}@phone.shiftway.local`;
  const userEmail = normalizedEmail || fallbackEmail;
  const existingUserRes = await client.query("SELECT * FROM users WHERE email = $1 FOR UPDATE", [userEmail]);
  let user = existingUserRes.rows[0];

  if (user && user.org_id !== invite.org_id) {
    throw createFlowError("email_in_use");
  }

  if (!user) {
    const resolvedFullName = String(fullName || invite.full_name || "").trim();
    if (!resolvedFullName) {
      throw createFlowError("missing_fields");
    }
    const userRes = await client.query(
      "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
      [invite.org_id, invite.location_id, resolvedFullName, userEmail, passwordHash, invite.role]
    );
    user = userRes.rows[0];
  }

  const markAcceptedRes = await client.query(
    "UPDATE invites SET accepted_at = now() WHERE id = $1 AND accepted_at IS NULL RETURNING id",
    [invite.id]
  );
  if (!markAcceptedRes.rows[0]) {
    throw createFlowError("invalid_invite");
  }

  const stateRes = await client.query("SELECT data FROM org_state WHERE org_id = $1", [invite.org_id]);
  const state = stateRes.rows[0]?.data || emptyOrgState();
  const existingUsers = Array.isArray(state.users) ? [...state.users] : [];
  const nextUserState = {
    id: user.id,
    location_id: user.location_id,
    full_name: user.full_name,
    email: invite.email || user.email || "",
    role: user.role,
    is_active: user.is_active,
    phone: invite.phone || "",
    birthday: "",
    pronouns: "",
    emergency_contact: { name: "", phone: "" },
    attachments: [],
    notes: "",
    wage: "",
  };
  const existingIndex = existingUsers.findIndex((candidate) => candidate.id === user.id);
  if (existingIndex >= 0) {
    existingUsers[existingIndex] = {
      ...existingUsers[existingIndex],
      ...nextUserState,
    };
  } else {
    existingUsers.push(nextUserState);
  }
  const nextState = { ...emptyOrgState(), ...state, users: existingUsers };

  await client.query(
    "INSERT INTO org_state (org_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (org_id) DO UPDATE SET data = $2, updated_at = now()",
    [invite.org_id, nextState]
  );

  return { user, created: !existingUserRes.rows[0] };
}

const getInviteByToken = async (token, { includeOrgName = false } = {}) => {
  if (!token) return null;
  const select = [
    "i.id",
    "i.org_id",
    "i.token",
    "i.email",
    "i.phone",
    "i.full_name",
    "i.role",
    "i.location_id",
    "i.invited_by",
    "i.expires_at",
    "i.accepted_at",
    "i.created_at",
    includeOrgName ? "o.name AS org_name" : null,
  ].filter(Boolean).join(", ");
  const from = includeOrgName ? "invites i JOIN orgs o ON o.id = i.org_id" : "invites i";
  const inviteRes = await query(`SELECT ${select} FROM ${from} WHERE i.token = $1`, [token]);
  const invite = inviteRes.rows[0];
  if (!invite) return null;
  if (invite.accepted_at) return { error: "invalid_invite" };
  if (new Date(invite.expires_at) < new Date()) return { error: "invalid_invite" };
  return invite;
};

const runTokenCleanup = async () => {
  try {
    await query("DELETE FROM magic_links WHERE expires_at < now() OR used_at IS NOT NULL");
    await query(
      "DELETE FROM invites WHERE (expires_at < now() OR accepted_at IS NOT NULL) AND created_at < now() - interval '7 days'"
    );
  } catch (err) {
    console.error("[shiftway-server] Token cleanup failed", err);
  }
};

void runTokenCleanup();
setInterval(() => {
  void runTokenCleanup();
}, 24 * 60 * 60 * 1000);

app.get("/api/health", async (req, res) => {
  const diagnostics = { env: process.env.NODE_ENV || "development", timestamp: new Date().toISOString() };
  try {
    await query("SELECT 1 as ok");
    res.json({ ok: true, db: true, ...diagnostics });
  } catch (err) {
    const msg = String(err?.message || "");
    const error = msg.includes("Missing DATABASE_URL") ? "db_not_configured" : "db_unreachable";
    res.status(503).json({ ok: false, db: false, error, ...diagnostics });
  }
});

// ── Public SaaS Signup ───────────────────────────────────────────────────────
// Creates org + owner + Stripe customer, then redirects to Stripe Checkout.
// This is the entry point for new businesses signing up on shiftway.app.
app.post("/api/public/signup", publicSignupRateLimiter, async (req, res) => {
  const { business_name, workspace_slug, owner_name, email, password } = req.body || {};

  const trimmedBusiness = String(business_name || "").trim();
  const trimmedOwner = String(owner_name || "").trim();
  const normalizedEmail = normalizeEmailInput(email);
  const rawPassword = String(password || "");
  const desiredSlug = String(workspace_slug || "").trim().toLowerCase();

  // Validation
  if (!trimmedBusiness || !trimmedOwner || !normalizedEmail || !rawPassword) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (!desiredSlug || !isValidSlug(desiredSlug)) {
    return res.status(400).json({
      error: "invalid_slug",
      message: "Workspace URL must be 2-48 lowercase letters, numbers, or hyphens, and start with a letter or number.",
    });
  }
  if (isReservedSlug(desiredSlug)) {
    return res.status(400).json({
      error: "invalid_slug",
      message: "That workspace URL is reserved.",
    });
  }

  // Check slug uniqueness
  const slugCheck = await query("SELECT id FROM orgs WHERE slug = $1", [desiredSlug]);
  if (slugCheck.rows[0]) {
    return res.status(400).json({ error: "slug_taken", message: "That workspace URL is already taken." });
  }

  // Check email uniqueness
  const emailCheck = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (emailCheck.rows[0]) {
    return res.status(400).json({ error: "email_in_use" });
  }

  const client = pool ? await pool.connect() : null;
  if (!client) throw new Error("Missing DATABASE_URL");

  let org, user;
  try {
    await client.query("BEGIN");

    const orgRes = await client.query(
      "INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING *",
      [trimmedBusiness, desiredSlug]
    );
    org = orgRes.rows[0];

    const locationRes = await client.query(
      "INSERT INTO locations (org_id, name) VALUES ($1, $2) RETURNING *",
      [org.id, "Main Location"]
    );
    const location = locationRes.rows[0];

    const hash = await bcrypt.hash(rawPassword, 10);
    const userRes = await client.query(
      "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
      [org.id, location.id, trimmedOwner, normalizedEmail, hash, "owner"]
    );
    user = userRes.rows[0];

    // Seed org state
    const data = seedState({ locationId: location.id, ownerUser: user });
    await client.query(
      "INSERT INTO org_state (org_id, data) VALUES ($1, $2)",
      [org.id, data]
    );

    // Create trial subscription row immediately so the user can log in during trial
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await client.query(
      "INSERT INTO subscriptions (org_id, status, trial_ends_at) VALUES ($1, $2, $3)",
      [org.id, "trialing", trialEndsAt]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    throw err;
  }
  client.release();

  const jwtToken = signToken(user);

  // If Stripe is configured, create a customer + checkout session
  if (stripe && process.env.STRIPE_PRICE_ID) {
    try {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        name: trimmedOwner,
        metadata: { org_id: org.id, org_slug: desiredSlug },
      });

      // Store the Stripe customer ID immediately
      await query(
        "UPDATE subscriptions SET stripe_customer_id = $1 WHERE org_id = $2",
        [customer.id, org.id]
      );

      const successUrl = `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${APP_URL}/billing/cancel`;

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        trial_period_days: TRIAL_DAYS,
        subscription_data: { metadata: { org_id: org.id } },
        metadata: { org_id: org.id },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return res.status(201).json({
        ok: true,
        token: jwtToken,
        user: sanitizeUser(user),
        org: { id: org.id, name: org.name, slug: org.slug },
        checkout_url: checkoutSession.url,
        status: "trialing",
      });
    } catch (stripeErr) {
      console.error("[public-signup] Stripe error (non-fatal):", stripeErr.message);
      // Fall through — user is created, they can subscribe later
    }
  }

  // Stripe not configured or failed — return token directly (trial access)
  res.status(201).json({
    ok: true,
    token: jwtToken,
    user: sanitizeUser(user),
    org: { id: org.id, name: org.name, slug: org.slug },
    checkout_url: null,
    status: "trialing",
  });
});

// ── Billing Routes ────────────────────────────────────────────────────────────

// Create a Stripe Checkout session for an existing org (upgrade/re-subscribe)
app.post("/api/billing/create-checkout-session", auth, requireRole("owner"), async (req, res) => {
  if (!stripe) return res.status(503).json({ error: "billing_not_configured" });
  if (!process.env.STRIPE_PRICE_ID) return res.status(503).json({ error: "stripe_price_not_configured" });

  const subRes = await query(
    "SELECT stripe_customer_id FROM subscriptions WHERE org_id = $1",
    [req.user.org_id]
  );
  const sub = subRes.rows[0];

  // Get or create Stripe customer
  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: req.user.full_name,
      metadata: { org_id: req.user.org_id },
    });
    customerId = customer.id;
    await query(
      `INSERT INTO subscriptions (org_id, stripe_customer_id, status)
       VALUES ($1, $2, 'trialing')
       ON CONFLICT (org_id) DO UPDATE SET stripe_customer_id = $2, updated_at = now()`,
      [req.user.org_id, customerId]
    );
  }

  const successUrl = `${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${APP_URL}/billing/cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    subscription_data: { metadata: { org_id: req.user.org_id } },
    metadata: { org_id: req.user.org_id },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  res.json({ checkout_url: session.url });
});

// Get billing status for the current org
app.get("/api/billing/status", auth, async (req, res) => {
  const orgRes = await query("SELECT slug FROM orgs WHERE id = $1", [req.user.org_id]);
  const orgSlug = orgRes.rows[0]?.slug || null;
  const subRes = await query(
    "SELECT status, plan, trial_ends_at, current_period_end, stripe_subscription_id FROM subscriptions WHERE org_id = $1",
    [req.user.org_id]
  );
  const sub = subRes.rows[0];
  if (!sub) return res.json({ status: null, slug: orgSlug, message: "No subscription found." });
  res.json({
    status: sub.status,
    plan: sub.plan,
    trial_ends_at: sub.trial_ends_at,
    current_period_end: sub.current_period_end,
    has_subscription: !!sub.stripe_subscription_id,
    slug: orgSlug,
  });
});

// Validate workspace slug availability (used during public signup form)
app.get("/api/public/check-slug", publicSlugCheckRateLimiter, async (req, res) => {
  const slug = String(req.query.slug || "").trim().toLowerCase();
  if (!slug || !isValidSlug(slug)) {
    return res.status(400).json({ available: false, error: "invalid_slug" });
  }
  if (isReservedSlug(slug)) {
    return res.json({ available: false, slug, error: "reserved_slug" });
  }
  const check = await query("SELECT id FROM orgs WHERE slug = $1", [slug]);
  res.json({ available: !check.rows[0], slug });
});

app.post("/api/auth/register", authRateLimiter, async (req, res) => {
  const { company_name, full_name, email, password } = req.body || {};
  const trimmedName = String(full_name || "").trim();
  const normalizedEmail = normalizeEmailInput(email);
  if (!trimmedName || !normalizedEmail || !password) return res.status(400).json({ error: "missing_fields" });
  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) return res.status(400).json({ error: "email_in_use" });
  const orgName = company_name || "New Company";
  // Generate a unique slug for the org
  const baseSlug = slugify(orgName);
  const slugSuffix = crypto.randomBytes(3).toString("hex");
  const orgSlug = `${baseSlug}-${slugSuffix}`;
  const org = await query("INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING *", [orgName, orgSlug]);
  const location = await query("INSERT INTO locations (org_id, name) VALUES ($1, $2) RETURNING *", [org.rows[0].id, "Main Location"]);
  const hash = await bcrypt.hash(password, 10);
  const userRes = await query(
    "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
    [org.rows[0].id, location.rows[0].id, trimmedName, normalizedEmail, hash, "owner"]
  );
  const user = userRes.rows[0];
  const data = await ensureOrgState(org.rows[0].id, location.rows[0].id, user);
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user), data });
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmailInput(email);
  if (!normalizedEmail || !password) return res.status(400).json({ error: "missing_fields" });
  const userRes = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = userRes.rows[0];
  if (!user || !user.password_hash) return res.status(400).json({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "invalid_credentials" });
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/magic/request", authRateLimiter, async (req, res) => {
  const { email, redirect_url } = req.body || {};
  const normalizedEmail = normalizeEmailInput(email);
  if (!normalizedEmail) return res.status(400).json({ error: "missing_email" });
  const userRes = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = userRes.rows[0];
  if (!user) return res.json({ ok: true });
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await query("INSERT INTO magic_links (user_id, token, expires_at) VALUES ($1,$2,$3)", [user.id, token, expires]);
  const safeRedirect = resolveSafeRedirectUrl(redirect_url, APP_URL);
  const url = `${APP_URL}/api/auth/magic/verify?token=${token}&redirect=${encodeURIComponent(safeRedirect)}`;
  sendEmailInBackground({
    to: normalizedEmail,
    subject: "Your Shiftway login link",
    text: `Click to sign in: ${url}`,
    correlationId: req.requestId,
    emailType: "magic_link",
  });
  res.json({ ok: true });
});

app.get("/api/debug/email-last", auth, requireRole("owner", "manager"), async (req, res) => {
  res.json({ ok: true, email: lastEmailDeliveryDebug });
});

app.get("/api/auth/magic/verify", magicVerifyRateLimiter, async (req, res) => {
  const { token, redirect } = req.query;
  if (!token) return res.status(400).send("Missing token");
  const linkRes = await query("SELECT * FROM magic_links WHERE token = $1", [token]);
  const link = linkRes.rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) return res.status(400).send("Invalid token");
  await query("UPDATE magic_links SET used_at = now() WHERE id = $1", [link.id]);
  const userRes = await query("SELECT * FROM users WHERE id = $1", [link.user_id]);
  const user = userRes.rows[0];
  const jwtToken = signToken(user);
  const redirectUrl = resolveSafeRedirectUrl(redirect, APP_URL);
  const safe = new URL(redirectUrl);
  safe.hash = `token=${encodeURIComponent(jwtToken)}`;
  res.redirect(safe.toString());
});

app.post("/api/auth/magic/verify", magicVerifyRateLimiter, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "missing_token" });
  const linkRes = await query("SELECT * FROM magic_links WHERE token = $1", [token]);
  const link = linkRes.rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) return res.status(400).json({ error: "invalid_token" });
  await query("UPDATE magic_links SET used_at = now() WHERE id = $1", [link.id]);
  const userRes = await query("SELECT * FROM users WHERE id = $1", [link.user_id]);
  const user = userRes.rows[0];
  const jwtToken = signToken(user);
  res.json({ token: jwtToken, user: sanitizeUser(user) });
});

app.get("/api/auth/google", (req, res, next) => {
  if (!passport._strategy("google")) return res.status(400).send("Google OAuth not configured");
  const nonce = crypto.randomBytes(24).toString("hex");
  const redirectUrl = resolveSafeRedirectUrl(req.query.redirect, APP_URL);
  const inviteToken = String(req.query.invite_token || "").trim();
  const inviteErrorRedirectUrl = inviteToken
    ? resolveSafeRedirectUrl(req.query.invite_redirect_url, `${APP_URL}/invite/accept${inviteToken ? `?token=${encodeURIComponent(inviteToken)}` : ""}`)
    : null;
  req.session.google_oauth = {
    nonce,
    redirect_url: redirectUrl,
    invite_token: inviteToken || null,
    invite_error_redirect_url: inviteErrorRedirectUrl,
    created_at: Date.now(),
  };
  passport.authenticate("google", { scope: ["profile", "email"], state: nonce })(req, res, next);
});

app.get("/api/auth/google/callback", (req, res, next) => {
  const pending = req.session?.google_oauth;
  const incomingState = String(req.query.state || "");
  const expectedState = typeof pending?.nonce === "string" ? pending.nonce : "";
  const sameLength = expectedState.length > 0 && incomingState.length === expectedState.length;
  const isStateValid = !!pending
    && sameLength
    && crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(incomingState))
    && Number.isFinite(pending.created_at)
    && (Date.now() - pending.created_at) <= (10 * 60 * 1000);
  const safeRedirect = resolveSafeRedirectUrl(pending?.redirect_url, APP_URL);
  const inviteErrorRedirect = resolveSafeRedirectUrl(pending?.invite_error_redirect_url, safeRedirect);
  if (!isStateValid) {
    if (req.session) delete req.session.google_oauth;
    return res.redirect(appendErrorToRedirectUrl(inviteErrorRedirect, "oauth_state_invalid"));
  }
  passport.authenticate("google", (err, user) => {
    if (req.session) delete req.session.google_oauth;
    if (err) {
      return res.redirect(appendErrorToRedirectUrl(inviteErrorRedirect, err.code || "google_auth_failed"));
    }
    if (!user) {
      return res.redirect(appendErrorToRedirectUrl(inviteErrorRedirect, "google_auth_failed"));
    }
    const token = signToken(user);
    const redirectWithToken = new URL(safeRedirect);
    redirectWithToken.hash = `token=${encodeURIComponent(token)}`;
    res.redirect(redirectWithToken.toString());
  })(req, res, next);
});

app.get("/api/me", auth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.patch("/api/me", auth, async (req, res) => {
  const payload = req.body || {};
  const hasFullName = hasOwn(payload, "full_name");
  const hasPhone = hasOwn(payload, "phone");
  const hasPronouns = hasOwn(payload, "pronouns");
  const hasBirthday = hasOwn(payload, "birthday");
  const hasEmergencyContact = hasOwn(payload, "emergency_contact");
  const hasEmail = hasOwn(payload, "email");
  const hasWage = hasOwn(payload, "wage");
  const trimmedName = hasFullName ? String(payload.full_name || "").trim() : String(req.user.full_name || "").trim();
  const normalizedEmail = hasEmail ? normalizeEmailInput(payload.email) : String(req.user.email || "").trim().toLowerCase();
  const wantsPasswordChange = String(payload.new_password || "").trim().length > 0;

  if (hasFullName && !trimmedName) return res.status(400).json({ error: "missing_fields" });
  if (hasEmail && !normalizedEmail) return res.status(400).json({ error: "missing_fields" });

  if (hasEmail && normalizedEmail !== String(req.user.email || "").trim().toLowerCase()) {
    const existing = await query("SELECT id FROM users WHERE email = $1 AND id <> $2", [normalizedEmail, req.user.id]);
    if (existing.rows[0]) return res.status(400).json({ error: "email_in_use" });
  }

  if (wantsPasswordChange) {
    const currentPassword = String(payload.current_password || "");
    if (!currentPassword) return res.status(400).json({ error: "missing_fields" });
    const ok = req.user.password_hash ? await bcrypt.compare(currentPassword, req.user.password_hash) : false;
    if (!ok) return res.status(400).json({ error: "invalid_password" });
  }

  const nextPasswordHash = wantsPasswordChange
    ? await bcrypt.hash(String(payload.new_password), 10)
    : req.user.password_hash;

  const userRes = await query(
    "UPDATE users SET full_name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING *",
    [trimmedName, normalizedEmail, nextPasswordHash, req.user.id]
  );
  const updatedUser = userRes.rows[0];

  const stateRes = await query("SELECT data FROM org_state WHERE org_id = $1", [req.user.org_id]);
  const state = stateRes.rows[0]?.data || emptyOrgState();
  const nextUsers = Array.isArray(state.users) ? [...state.users] : [];
  const userIndex = nextUsers.findIndex((user) => user.id === req.user.id);
  const previousStateUser = userIndex >= 0 ? nextUsers[userIndex] : {};
  const nextEmergency = hasEmergencyContact
    ? {
        name: String(payload.emergency_contact?.name || "").trim(),
        phone: String(payload.emergency_contact?.phone || "").trim(),
      }
    : {
        name: String(previousStateUser.emergency_contact?.name || ""),
        phone: String(previousStateUser.emergency_contact?.phone || ""),
      };
  const nextWage = hasWage
    ? (payload.wage === "" || payload.wage == null ? "" : payload.wage)
    : (previousStateUser.wage ?? "");
  const mergedStateUser = {
    ...previousStateUser,
    id: req.user.id,
    location_id: updatedUser.location_id,
    full_name: trimmedName,
    email: normalizedEmail,
    role: updatedUser.role,
    is_active: updatedUser.is_active,
    phone: hasPhone ? String(payload.phone || "").trim() : String(previousStateUser.phone || ""),
    birthday: hasBirthday ? String(payload.birthday || "").trim() : String(previousStateUser.birthday || ""),
    pronouns: hasPronouns ? String(payload.pronouns || "").trim() : String(previousStateUser.pronouns || ""),
    emergency_contact: nextEmergency,
    attachments: Array.isArray(previousStateUser.attachments) ? previousStateUser.attachments : [],
    notes: String(previousStateUser.notes || ""),
    wage: nextWage,
  };
  if (userIndex >= 0) nextUsers[userIndex] = mergedStateUser;
  else nextUsers.push(mergedStateUser);

  const nextState = { ...emptyOrgState(), ...state, users: nextUsers };
  await query(
    "INSERT INTO org_state (org_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (org_id) DO UPDATE SET data = $2, updated_at = now()",
    [req.user.org_id, nextState]
  );

  res.json({ ok: true, user: sanitizeUser(updatedUser) });
});

app.get("/api/state", auth, requireActiveSubscription, async (req, res) => {
  const stateRes = await query("SELECT data FROM org_state WHERE org_id = $1", [req.user.org_id]);
  if (!stateRes.rows[0]) {
    const data = await ensureOrgState(req.user.org_id, req.user.location_id, req.user);
    return res.json({ data });
  }
  res.json({ data: stateRes.rows[0].data });
});

app.post("/api/state", auth, requireActiveSubscription, requireRole("manager", "owner"), async (req, res) => {
  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: "missing_data" });
  const validation = validateOrgStatePayload(data);
  if (!validation.ok) return res.status(400).json({ error: validation.error });
  const cleaned = { ...data };
  if (Array.isArray(cleaned.users)) {
    cleaned.users = cleaned.users.map((u) => ({ ...u, password: undefined }));
  }
  await query("INSERT INTO org_state (org_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (org_id) DO UPDATE SET data = $2, updated_at = now()", [req.user.org_id, cleaned]);
  res.json({ ok: true });
});

app.post("/api/users", auth, requireActiveSubscription, requireRole("manager", "owner"), async (req, res) => {
  const { full_name, email, role, location_id, password } = req.body || {};
  if (!full_name || !email) return res.status(400).json({ error: "missing_fields" });
  const normalizedEmail = normalizeEmailInput(email);
  if (!normalizedEmail) return res.status(400).json({ error: "missing_fields" });
  const requestedRole = String(role || "employee").trim().toLowerCase();
  if (!["employee", "manager", "owner"].includes(requestedRole)) {
    return res.status(400).json({ error: "invalid_role" });
  }
  if (requestedRole === "owner" && req.user.role !== "owner") {
    return res.status(403).json({ error: "forbidden" });
  }
  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) return res.status(400).json({ error: "email_in_use" });
  let resolvedLocationId = req.user.location_id;
  if (location_id) {
    const locationRes = await query(
      "SELECT id FROM locations WHERE id = $1 AND org_id = $2",
      [location_id, req.user.org_id]
    );
    if (!locationRes.rows[0]) return res.status(404).json({ error: "not_found" });
    resolvedLocationId = locationRes.rows[0].id;
  }
  const hash = password ? await bcrypt.hash(password, 10) : null;
  const userRes = await query(
    "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *",
    [req.user.org_id, resolvedLocationId, full_name, normalizedEmail, hash, requestedRole]
  );
  res.json({ user: sanitizeUser(userRes.rows[0]) });
});

app.get("/api/push/public-key", auth, async (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

app.post("/api/push/subscribe", auth, async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription) return res.status(400).json({ error: "missing_subscription" });
  const { endpoint, keys } = subscription;
  await query(
    "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, endpoint) DO NOTHING",
    [req.user.id, endpoint, keys?.p256dh || "", keys?.auth || ""]
  );
  res.json({ ok: true });
});

app.post("/api/notify", auth, requireActiveSubscription, requireRole("manager", "owner"), async (req, res) => {
  const { user_ids, title, body, channels } = req.body || {};
  if (!Array.isArray(user_ids) || user_ids.length === 0) return res.status(400).json({ error: "missing_recipients" });
  const recipientIds = [...new Set(
    user_ids
      .map((id) => String(id || "").trim())
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  )];
  if (recipientIds.length === 0 || recipientIds.length !== user_ids.length) {
    return res.status(400).json({ error: "invalid_recipients" });
  }
  const usersRes = await query(
    "SELECT id, email FROM users WHERE org_id = $1 AND id = ANY($2::uuid[])",
    [req.user.org_id, recipientIds]
  );
  if (usersRes.rows.length !== recipientIds.length) {
    return res.status(400).json({ error: "invalid_recipients" });
  }
  const stateRes = await query("SELECT data FROM org_state WHERE org_id = $1", [req.user.org_id]);
  const stateUsers = stateRes.rows[0]?.data?.users || [];
  const userById = Object.fromEntries(stateUsers.map((u) => [u.id, u]));
  const emailEnabled = channels?.email !== false;
  const smsEnabled = !!channels?.sms;
  const pushEnabled = !!channels?.push;

  if (emailEnabled) {
    await Promise.all(usersRes.rows.map((u) => sendEmail({ to: u.email, subject: title, text: body })));
  }
  if (smsEnabled) {
    await Promise.all(usersRes.rows.map((u) => {
      const phone = userById[u.id]?.phone;
      if (!phone) return null;
      return sendSms({ to: phone, body: `${title}\n${body}` });
    }));
  }
  if (pushEnabled) {
    const subsRes = await query(
      `SELECT ps.endpoint, ps.p256dh, ps.auth
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.org_id = $1 AND ps.user_id = ANY($2::uuid[])`,
      [req.user.org_id, recipientIds]
    );
    const subs = subsRes.rows.map((s) => ({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }));
    await sendPush({ subscriptions: subs, title, body });
  }
  res.json({ ok: true });
});

app.post("/api/invite", auth, requireActiveSubscription, requireRole("manager", "owner"), async (req, res) => {
  const { full_name, email, phone, role, location_id } = req.body || {};
  const trimmedName = String(full_name || "").trim();
  const normalizedEmail = normalizeEmailInput(email);
  const trimmedPhone = String(phone || "").trim();
  const inviteRole = String(role || "employee").trim().toLowerCase();

  if (!trimmedName || (!normalizedEmail && !trimmedPhone)) {
    return res.status(400).json({ error: "missing_fields" });
  }
  if (!["employee", "manager"].includes(inviteRole)) {
    return res.status(400).json({ error: "invalid_role" });
  }

  let nextLocationId = location_id || null;
  if (nextLocationId) {
    const locationRes = await query("SELECT id FROM locations WHERE id = $1 AND org_id = $2", [nextLocationId, req.user.org_id]);
    if (!locationRes.rows[0]) return res.status(404).json({ error: "not_found" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const inviteRes = await query(
    "INSERT INTO invites (org_id, token, email, phone, full_name, role, location_id, invited_by, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    [req.user.org_id, token, normalizedEmail || null, trimmedPhone || null, trimmedName, inviteRole, nextLocationId, req.user.id, expiresAt]
  );

  const inviteUrl = `${APP_URL}/invite/accept?token=${token}`;
  const message = `You have been invited to Shiftway. Accept your invite here: ${inviteUrl}`;

  if (normalizedEmail) {
    await sendEmail({
      to: normalizedEmail,
      subject: "You have been invited to Shiftway",
      text: message,
    });
  }
  if (trimmedPhone && smsClient) {
    await sendSms({ to: trimmedPhone, body: message });
  }

  res.json({ ok: true, invite_id: inviteRes.rows[0].id, invite_url: inviteUrl });
});

app.get("/api/invite/verify", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).json({ error: "missing_token" });

  const invite = await getInviteByToken(token, { includeOrgName: true });
  if (!invite || invite.error) return res.status(400).json({ error: "invalid_invite" });

  res.json({
    ok: true,
    full_name: invite.full_name,
    email: invite.email,
    role: invite.role,
    org_name: invite.org_name,
    google_invite_supported: !!invite.email && !!passport._strategy("google"),
  });
});

app.post("/api/invite/accept", async (req, res) => {
  const { token, password, full_name } = req.body || {};
  const inviteToken = String(token || "").trim();
  const trimmedName = String(full_name || "").trim();
  const rawPassword = String(password || "");

  if (!inviteToken) return res.status(400).json({ error: "missing_token" });
  if (!trimmedName || !rawPassword) return res.status(400).json({ error: "missing_fields" });

  const client = pool ? await pool.connect() : null;
  if (!client) {
    throw new Error(
      "Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL (Postgres connection string)."
    );
  }

  try {
    await client.query("BEGIN");

    const inviteRes = await client.query(
      "SELECT * FROM invites WHERE token = $1 FOR UPDATE",
      [inviteToken]
    );
    const invite = inviteRes.rows[0];
    if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "invalid_invite" });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const { user } = await acceptInviteWithIdentity(client, invite, {
      fullName: trimmedName,
      passwordHash,
    });

    await client.query("COMMIT");

    res.json({ token: signToken(user), user: sanitizeUser(user) });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback errors after failure
    }
    throw err;
  } finally {
    client.release();
  }
});

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

app.use((err, req, res, next) => {
  console.error("[shiftway-server] Unhandled route error", err);
  if (res.headersSent) return next(err);

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "invalid_json",
      message: "Request body contains invalid JSON.",
      requestId: req.requestId,
    });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      error: "payload_too_large",
      message: "Request payload is too large.",
      requestId: req.requestId,
    });
  }

  if (err?.message === "origin_not_allowed") {
    return res.status(403).json({ error: "forbidden", message: "Request origin is not allowed by CORS.", requestId: req.requestId });
  }

  // Surface infrastructure failures with stable, client-friendly codes.
  // This keeps Live mode actionable when the API is up but DB wiring is not.
  const rawMessage = String(err?.message || "");
  const dbConfigMissing = rawMessage.includes("Missing DATABASE_URL");
  const dbUnreachable = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH"].includes(err?.code) || rawMessage.includes("connect ECONNREFUSED") || rawMessage.includes("connect ETIMEDOUT") || rawMessage.includes("getaddrinfo ENOTFOUND") || rawMessage.includes("timeout expired");

  if (dbConfigMissing) {
    return res.status(503).json({
      error: "db_not_configured",
      message: "Database is not configured on the backend.",
      requestId: req.requestId,
    });
  }

  if (dbUnreachable) {
    return res.status(503).json({
      error: "db_unreachable",
      message: "Database is unreachable from the backend.",
      requestId: req.requestId,
    });
  }

  const message = isProd ? "Internal server error" : (err?.message || "Internal server error");
  res.status(500).json({ error: "internal_error", message, requestId: req.requestId });
});

app.listen(PORT, () => {
  console.log(`Shiftway server listening on ${PORT}`);
  if (isProd) {
    console.log(`[shiftway-server] Allowed CORS origins: ${allowedWebOrigins.join(", ") || "(none configured)"}`);
  }
});
