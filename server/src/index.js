import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import nodemailer from "nodemailer";
import twilio from "twilio";
import webpush from "web-push";
import Stripe from "stripe";
import pool, { query } from "./db.js";
import {
  DEFAULT_BILLING_PERIOD,
  DEFAULT_PLAN_KEY,
  FREE_PLAN_KEY,
  appendQueryParams,
  buildStoredPlanCode,
  getSelectionForStripePriceId,
  getStripePriceIdForSelection,
  isPaidPlanKey,
  normalizeBillingPeriod,
  normalizeBillingPlan,
  parseStoredPlanCode,
} from "./billing.js";
import { removeUserFromOrgState } from "./state_utils.js";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 4000;
const APP_URL = process.env.APP_URL || "http://localhost:5173";
const SAAS_DOMAIN = String(process.env.SAAS_DOMAIN || "shiftway.app").trim().toLowerCase();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session";
const ACCESS_TOKEN_TTL = String(process.env.JWT_ACCESS_TTL || "15m").trim();
const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(String(process.env.JWT_REFRESH_TTL_DAYS || "30"), 10);
const MAGIC_LINK_TTL_MINUTES = Number.parseInt(String(process.env.MAGIC_LINK_TTL_MINUTES || "15"), 10);
const PASSWORD_RESET_TTL_MINUTES = Number.parseInt(String(process.env.PASSWORD_RESET_TTL_MINUTES || "30"), 10);
const EMAIL_VERIFICATION_TTL_HOURS = Number.parseInt(String(process.env.EMAIL_VERIFICATION_TTL_HOURS || "24"), 10);
const GOOGLE_STATE_TTL_MINUTES = Number.parseInt(String(process.env.GOOGLE_STATE_TTL_MINUTES || "10"), 10);
const REQUIRE_EMAIL_VERIFICATION = String(process.env.REQUIRE_EMAIL_VERIFICATION || (isProd ? "1" : "0")).trim() === "1";
const DEBUG_EMAIL_LAST_ENABLED = String(process.env.DEBUG_EMAIL_LAST_ENABLED || (isProd ? "0" : "1")).trim() === "1";

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

const validateStartupConfig = () => {
  const failures = [];

  const validateOriginOnly = (value, label) => {
    try {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) {
        failures.push(`${label} must use http:// or https://`);
        return;
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
        failures.push(`${label} must be origin only (no path/query/hash)`);
      }
    } catch {
      failures.push(`${label} must be a valid URL`);
    }
  };

  validateOriginOnly(APP_URL, "APP_URL");
  for (const origin of allowedWebOrigins) validateOriginOnly(origin, "APP_ALLOWED_ORIGINS entry");

  if (isProd) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret") {
      failures.push("JWT_SECRET missing or insecure in production");
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "dev-session") {
      failures.push("SESSION_SECRET missing or insecure in production");
    }
  }

  if ((process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_SECRET) || (!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)) {
    failures.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together");
  }

  if (process.env.SMTP_URL && !process.env.EMAIL_FROM) {
    failures.push("EMAIL_FROM is required when SMTP_URL is configured");
  }

  if (Number.isNaN(REFRESH_TOKEN_TTL_DAYS) || REFRESH_TOKEN_TTL_DAYS <= 0) {
    failures.push("JWT_REFRESH_TTL_DAYS must be a positive integer");
  }
  if (Number.isNaN(MAGIC_LINK_TTL_MINUTES) || MAGIC_LINK_TTL_MINUTES <= 0) {
    failures.push("MAGIC_LINK_TTL_MINUTES must be a positive integer");
  }
  if (Number.isNaN(PASSWORD_RESET_TTL_MINUTES) || PASSWORD_RESET_TTL_MINUTES <= 0) {
    failures.push("PASSWORD_RESET_TTL_MINUTES must be a positive integer");
  }
  if (Number.isNaN(EMAIL_VERIFICATION_TTL_HOURS) || EMAIL_VERIFICATION_TTL_HOURS <= 0) {
    failures.push("EMAIL_VERIFICATION_TTL_HOURS must be a positive integer");
  }
  if (Number.isNaN(GOOGLE_STATE_TTL_MINUTES) || GOOGLE_STATE_TTL_MINUTES <= 0) {
    failures.push("GOOGLE_STATE_TTL_MINUTES must be a positive integer");
  }

  if (failures.length) {
    const message = failures.map((line) => `- ${line}`).join("\n");
    throw new Error(`[shiftway-server] Startup config validation failed:\n${message}`);
  }
};

validateStartupConfig();

const app = express();

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
const normalizeAttachmentMeta = (attachment = {}) => ({
  id: String(attachment.id || randomToken(6)),
  name: String(attachment.name || "").trim(),
  label: String(attachment.label || "General document").trim() || "General document",
  size: Math.max(0, Number(attachment.size) || 0),
  type: String(attachment.type || "").trim(),
  lastModified: Number(attachment.lastModified) || null,
  uploaded_at: String(attachment.uploaded_at || new Date().toISOString()),
});
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
const hashToken = (token) => crypto.createHash("sha256").update(String(token || "")).digest("hex");
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("hex");
const normalizeSlugInput = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
const isValidWorkspaceSlug = (value) => /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$|^[a-z0-9]{3,}$/.test(String(value || ""));
const deriveSlugFromName = (name) => {
  const base = normalizeSlugInput(String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  return base || `workspace-${randomToken(3)}`;
};
const deriveOrgNameFromIdentity = ({ companyName, displayName, email }) => {
  const trimmedCompany = String(companyName || "").trim();
  if (trimmedCompany) return trimmedCompany;
  const trimmedDisplayName = String(displayName || "").trim();
  if (trimmedDisplayName) return `${trimmedDisplayName}'s Workspace`;
  const local = String(email || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  if (local) return `${local.charAt(0).toUpperCase()}${local.slice(1)} Workspace`;
  return "New Workspace";
};
const extractWorkspaceSlugFromHost = (hostValue) => {
  const host = String(hostValue || "").trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) return null;
  if (host.endsWith(`.${SAAS_DOMAIN}`)) {
    const slug = host.slice(0, -(`.${SAAS_DOMAIN}`.length));
    if (slug && slug !== "www") return normalizeSlugInput(slug);
  }
  if (host.endsWith(".localhost")) {
    const slug = host.slice(0, -".localhost".length);
    if (slug) return normalizeSlugInput(slug);
  }
  return null;
};
const extractWorkspaceSlugFromRequest = (req, { includeBody = true } = {}) => {
  const fromHeader = normalizeSlugInput(req.headers["x-org-slug"]);
  if (isValidWorkspaceSlug(fromHeader)) return fromHeader;

  const fromQuery = normalizeSlugInput(req.query.workspace_slug || req.query.org);
  if (isValidWorkspaceSlug(fromQuery)) return fromQuery;

  if (includeBody) {
    const fromBody = normalizeSlugInput(req.body?.workspace_slug || req.body?.org);
    if (isValidWorkspaceSlug(fromBody)) return fromBody;
  }

  try {
    const fromOrigin = extractWorkspaceSlugFromHost(req.headers.origin ? new URL(String(req.headers.origin)).host : "");
    if (isValidWorkspaceSlug(fromOrigin)) return fromOrigin;
  } catch {
    // ignore invalid origin
  }

  try {
    const refererUrl = new URL(String(req.headers.referer || ""));
    const refererParam = normalizeSlugInput(refererUrl.searchParams.get("org"));
    if (isValidWorkspaceSlug(refererParam)) return refererParam;
    const fromRefererHost = extractWorkspaceSlugFromHost(refererUrl.host);
    if (isValidWorkspaceSlug(fromRefererHost)) return fromRefererHost;
  } catch {
    // ignore invalid referer
  }

  return null;
};
const resolveSafeRedirectUrl = (candidate, fallbackUrl = APP_URL) => {
  const fallback = normalizeOrigin(fallbackUrl) || APP_URL;
  const raw = String(candidate || "").trim();
  if (!raw) return fallbackUrl;
  try {
    const parsed = new URL(raw);
    if (!APP_ALLOWED_ORIGINS.has(parsed.origin.toLowerCase())) {
      return fallbackUrl;
    }
    return parsed.toString();
  } catch {
    return fallbackUrl;
  }
};
const signStatePayload = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};
const verifyStatePayload = (token) => {
  const raw = String(token || "");
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;
  const expectedSignature = crypto.createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (Number(parsed.exp || 0) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parsePgArrayTimestamp = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
const SMTP_CONNECTION_TIMEOUT_MS = parsePositiveIntEnv("SMTP_CONNECTION_TIMEOUT_MS", 5000);
const SMTP_GREETING_TIMEOUT_MS = parsePositiveIntEnv("SMTP_GREETING_TIMEOUT_MS", 5000);
const SMTP_SOCKET_TIMEOUT_MS = parsePositiveIntEnv("SMTP_SOCKET_TIMEOUT_MS", 15000);
const SMTP_SEND_TIMEOUT_MS = parsePositiveIntEnv("SMTP_SEND_TIMEOUT_MS", 8000);
const EMAIL_MAX_RETRIES = parsePositiveIntEnv("EMAIL_MAX_RETRIES", 3);
const EMAIL_RETRY_BASE_DELAY_MS = parsePositiveIntEnv("EMAIL_RETRY_BASE_DELAY_MS", 750);
const ORG_STATE_MAX_BYTES = parsePositiveIntEnv("ORG_STATE_MAX_BYTES", 1_500_000);
const TRIAL_DAYS = parsePositiveIntEnv("TRIAL_DAYS", 14);
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

app.use(cors({
  origin: isProd
    ? (origin, cb) => {
        // Allow non-browser requests (no Origin header) and explicitly configured web origins.
        if (!origin) return cb(null, true);
        const normalizedOrigin = normalizeOrigin(origin);
        if (APP_ALLOWED_ORIGINS.has(normalizedOrigin)) return cb(null, true);
        return cb(new Error("origin_not_allowed"));
      }
    : true,
  credentials: true,
}));
app.use(express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    if (req.originalUrl === "/api/billing/webhook") {
      req.rawBody = Buffer.from(buf);
    }
  },
}));
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

app.use(passport.initialize());

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `${APP_URL}/api/auth/google/callback`,
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = normalizeEmailInput(profile.emails?.[0]?.value);
      if (!email) return done(new Error("No email from Google"));

      const requestedSlug = isValidWorkspaceSlug(req?.oauthState?.workspaceSlug)
        ? normalizeSlugInput(req.oauthState.workspaceSlug)
        : null;
      const existing = await query(
        "SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.email = $1",
        [email]
      );

      if (existing.rows[0]) {
        if (requestedSlug && existing.rows[0].org_slug !== requestedSlug) {
          return done(new Error("workspace_mismatch"));
        }
        return done(null, existing.rows[0]);
      }

      const orgName = deriveOrgNameFromIdentity({ displayName: profile.displayName, email });
      const desiredSlug = requestedSlug || deriveSlugFromName(orgName);
      const orgSlug = await ensureUniqueOrgSlug(desiredSlug);
      const org = await query("INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING *", [orgName, orgSlug]);
      const location = await query("INSERT INTO locations (org_id, name) VALUES ($1, $2) RETURNING *", [org.rows[0].id, "Main Location"]);
      const user = await query(
        "INSERT INTO users (org_id, location_id, full_name, email, role, is_active, email_verified_at) VALUES ($1,$2,$3,$4,$5,true,now()) RETURNING *",
        [org.rows[0].id, location.rows[0].id, profile.displayName || "Owner", email, "owner"]
      );
      await ensureOrgState(org.rows[0].id, location.rows[0].id, user.rows[0]);
      await ensureOrgSubscription(org.rows[0].id);
      done(null, user.rows[0]);
    } catch (err) {
      done(err);
    }
  }));
}

const signToken = (user) => jwt.sign({ userId: user.id, orgId: user.org_id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const createRefreshToken = async (user) => {
  const rawToken = randomToken(48);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query("INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [user.id, tokenHash, expiresAt]);
  return { refreshToken: rawToken, expiresAt };
};

const consumeRefreshToken = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  const tokenRes = await query("SELECT * FROM user_refresh_tokens WHERE token_hash = $1", [tokenHash]);
  const row = tokenRes.rows[0];
  if (!row) return null;
  if (row.revoked_at || new Date(row.expires_at) < new Date()) return null;
  await query("UPDATE user_refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);
  const userRes = await query("SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = $1", [row.user_id]);
  return userRes.rows[0] || null;
};

const auth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing_token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userRes = await query("SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = $1", [payload.userId]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: "invalid_user" });
    const requestedSlug = extractWorkspaceSlugFromRequest(req, { includeBody: false });
    if (requestedSlug && user.org_slug && requestedSlug !== user.org_slug) {
      return res.status(403).json({ error: "forbidden", message: "Workspace mismatch." });
    }
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

const ensureUniqueOrgSlug = async (candidate) => {
  const normalized = normalizeSlugInput(candidate);
  const base = isValidWorkspaceSlug(normalized) ? normalized : deriveSlugFromName(normalized || "workspace");
  let nextSlug = base;
  let attempts = 0;

  while (attempts < 8) {
    const existing = await query("SELECT id FROM orgs WHERE slug = $1", [nextSlug]);
    if (!existing.rows[0]) return nextSlug;
    attempts += 1;
    nextSlug = `${base}-${randomToken(2)}`;
  }

  throw new Error("slug_generation_failed");
};

const getOrgBySlug = async (slug) => {
  const normalized = normalizeSlugInput(slug);
  if (!isValidWorkspaceSlug(normalized)) return null;
  const orgRes = await query("SELECT * FROM orgs WHERE slug = $1", [normalized]);
  return orgRes.rows[0] || null;
};

const isBillingStatusActive = (status) => ["active", "trialing"].includes(String(status || "").toLowerCase());

const createInitialSubscriptionValues = ({ planKey = DEFAULT_PLAN_KEY, billingPeriod = DEFAULT_BILLING_PERIOD } = {}) => {
  const normalizedPlanKey = normalizeBillingPlan(planKey) || DEFAULT_PLAN_KEY;
  if (normalizedPlanKey === FREE_PLAN_KEY) {
    return {
      status: "active",
      plan: buildStoredPlanCode(FREE_PLAN_KEY),
      trialEndsAt: null,
      currentPeriodEnd: null,
    };
  }

  const trialEndsAt = TRIAL_DAYS > 0 ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  return {
    status: trialEndsAt ? "trialing" : "inactive",
    plan: buildStoredPlanCode(normalizedPlanKey, billingPeriod),
    trialEndsAt,
    currentPeriodEnd: trialEndsAt,
  };
};

const expireLocalTrialIfNeeded = async (subscription) => {
  if (!subscription) return null;
  if (String(subscription.status || "").toLowerCase() !== "trialing") return subscription;
  if (subscription.stripe_subscription_id) return subscription;

  const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  if (!trialEndsAt || Number.isNaN(trialEndsAt.getTime()) || trialEndsAt.getTime() > Date.now()) {
    return subscription;
  }

  const updatedRes = await query(
    "UPDATE subscriptions SET status = $2, updated_at = now() WHERE id = $1 RETURNING *",
    [subscription.id, "inactive"]
  );
  return updatedRes.rows[0] || subscription;
};

const getBillingStatusByOrgId = async (orgId) => {
  const subRes = await query("SELECT * FROM subscriptions WHERE org_id = $1", [orgId]);
  if (!subRes.rows[0]) return null;
  return expireLocalTrialIfNeeded(subRes.rows[0]);
};

const ensureOrgSubscription = async (orgId, { planKey = DEFAULT_PLAN_KEY, billingPeriod = DEFAULT_BILLING_PERIOD } = {}) => {
  const existing = await getBillingStatusByOrgId(orgId);
  if (existing) return existing;

  const initialSubscription = createInitialSubscriptionValues({ planKey, billingPeriod });
  const subRes = await query(
    "INSERT INTO subscriptions (org_id, status, plan, trial_ends_at, current_period_end) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [
      orgId,
      initialSubscription.status,
      initialSubscription.plan,
      initialSubscription.trialEndsAt,
      initialSubscription.currentPeriodEnd,
    ]
  );
  return subRes.rows[0];
};

const requireActiveSubscription = async (req, res, next) => {
  const billing = await ensureOrgSubscription(req.user.org_id);
  if (!isBillingStatusActive(billing?.status)) {
    return res.status(402).json({
      error: "billing_required",
      status: billing?.status || "inactive",
      org_slug: req.user.org_slug || null,
    });
  }
  req.billing = billing;
  next();
};

const createOrgAndOwner = async ({
  orgName,
  workspaceSlug,
  ownerName,
  email,
  passwordHash = null,
  emailVerifiedAt = null,
  initialPlanKey = DEFAULT_PLAN_KEY,
  initialBillingPeriod = DEFAULT_BILLING_PERIOD,
}) => {
  const normalizedEmail = normalizeEmailInput(email);
  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) {
    const err = new Error("email_in_use");
    err.code = "email_in_use";
    throw err;
  }

  const uniqueSlug = await ensureUniqueOrgSlug(workspaceSlug);
  const orgRes = await query("INSERT INTO orgs (name, slug) VALUES ($1, $2) RETURNING *", [orgName, uniqueSlug]);
  const org = orgRes.rows[0];
  const locationRes = await query("INSERT INTO locations (org_id, name) VALUES ($1, $2) RETURNING *", [org.id, "Main Location"]);
  const location = locationRes.rows[0];
  const userRes = await query(
    "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active, email_verified_at) VALUES ($1, $2, $3, $4, $5, 'owner', true, $6) RETURNING *",
    [org.id, location.id, String(ownerName || "").trim() || "Owner", normalizedEmail, passwordHash, emailVerifiedAt]
  );
  const user = userRes.rows[0];
  const data = await ensureOrgState(org.id, location.id, user);
  const subscription = await ensureOrgSubscription(org.id, {
    planKey: initialPlanKey,
    billingPeriod: initialBillingPeriod,
  });
  return { org, location, user, data, subscription };
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
    lastEmailDeliveryDebug = {
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

const sendEmailWithRetry = async (options, { attempts = EMAIL_MAX_RETRIES, baseDelayMs = EMAIL_RETRY_BASE_DELAY_MS } = {}) => {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await sendEmail(options);
    } catch (err) {
      lastError = err;
      if (attempt >= attempts) break;
      await sleep(baseDelayMs * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error("email_delivery_failed");
};

const sendEmailWithRetryInBackground = (options, retryOptions = {}) => {
  setImmediate(() => {
    void sendEmailWithRetry(options, retryOptions).catch(() => {});
  });
};

const sendEmailInBackground = (options) => {
  sendEmailWithRetryInBackground(options);
};

const sendSms = async ({ to, body }) => {
  if (!smsClient || !process.env.TWILIO_FROM) return false;
  await smsClient.messages.create({ to, from: process.env.TWILIO_FROM, body });
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

const createEmailVerificationToken = async (userId) => {
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  await query("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [userId, tokenHash, expiresAt]);
  return token;
};

const createPasswordResetToken = async (userId) => {
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  await query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [userId, tokenHash, expiresAt]);
  return token;
};

const sendEmailVerificationLink = async ({ user, redirectUrl, correlationId }) => {
  const token = await createEmailVerificationToken(user.id);
  const safeRedirect = resolveSafeRedirectUrl(redirectUrl || APP_URL);
  const verifyUrl = `${APP_URL}/api/auth/email/verify?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(safeRedirect)}`;
  sendEmailWithRetryInBackground({
    to: user.email,
    subject: "Verify your Shiftway email",
    text: `Verify your email address: ${verifyUrl}`,
    correlationId,
    emailType: "email_verification",
  });
};

const sendPasswordResetLink = async ({ user, redirectUrl, correlationId }) => {
  const token = await createPasswordResetToken(user.id);
  const safeRedirect = resolveSafeRedirectUrl(redirectUrl || APP_URL);
  const resetUrl = `${safeRedirect.replace(/\/$/, "")}/?reset_token=${encodeURIComponent(token)}`;
  sendEmailWithRetryInBackground({
    to: user.email,
    subject: "Reset your Shiftway password",
    text: `Reset your password: ${resetUrl}`,
    correlationId,
    emailType: "password_reset",
  });
};

const createAuthResponse = async (user, extra = {}) => {
  const token = signToken(user);
  const { refreshToken } = await createRefreshToken(user);
  return {
    token,
    refresh_token: refreshToken,
    user: sanitizeUser(user),
    ...extra,
  };
};

const upsertSubscriptionFromStripe = async ({ orgId, customerId, subscriptionId, status, plan, currentPeriodEnd, trialEndsAt }) => {
  await query(
    `INSERT INTO subscriptions (org_id, stripe_customer_id, stripe_subscription_id, status, plan, current_period_end, trial_ends_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (org_id)
     DO UPDATE SET
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       status = EXCLUDED.status,
       plan = EXCLUDED.plan,
       current_period_end = EXCLUDED.current_period_end,
       trial_ends_at = EXCLUDED.trial_ends_at,
       updated_at = now()`,
    [orgId, customerId || null, subscriptionId || null, status || "inactive", plan || null, currentPeriodEnd || null, trialEndsAt || null]
  );
};

const createCheckoutSessionForOrg = async ({
  org,
  ownerUser,
  planKey = DEFAULT_PLAN_KEY,
  billingPeriod = DEFAULT_BILLING_PERIOD,
}) => {
  const normalizedPlanKey = normalizeBillingPlan(planKey) || DEFAULT_PLAN_KEY;
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod) || DEFAULT_BILLING_PERIOD;
  const priceId = getStripePriceIdForSelection({
    planKey: normalizedPlanKey,
    billingPeriod: normalizedBillingPeriod,
  });
  if (!stripe || !isPaidPlanKey(normalizedPlanKey) || !priceId) return null;

  const currentSubscription = await ensureOrgSubscription(org.id, {
    planKey: normalizedPlanKey,
    billingPeriod: normalizedBillingPeriod,
  });
  const pendingSubscription = createInitialSubscriptionValues({
    planKey: normalizedPlanKey,
    billingPeriod: normalizedBillingPeriod,
  });
  let customerId = currentSubscription?.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ownerUser?.email || undefined,
      name: org.name,
      metadata: {
        org_id: org.id,
        org_slug: org.slug || "",
        plan_key: normalizedPlanKey,
        billing_period: normalizedBillingPeriod,
      },
    });
    customerId = customer.id;
  }

  const successUrl = appendQueryParams(
    String(process.env.BILLING_SUCCESS_URL || `${APP_URL}/billing/success`),
    { plan: normalizedPlanKey, billing_period: normalizedBillingPeriod }
  );
  const cancelUrl = appendQueryParams(
    String(process.env.BILLING_CANCEL_URL || `${APP_URL}/billing/cancel`),
    { plan: normalizedPlanKey, billing_period: normalizedBillingPeriod }
  );
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      org_id: org.id,
      org_slug: org.slug || "",
      plan_key: normalizedPlanKey,
      billing_period: normalizedBillingPeriod,
    },
    subscription_data: {
      ...(TRIAL_DAYS > 0 ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: {
        org_id: org.id,
        org_slug: org.slug || "",
        plan_key: normalizedPlanKey,
        billing_period: normalizedBillingPeriod,
      },
    },
  });

  await upsertSubscriptionFromStripe({
    orgId: org.id,
    customerId,
    subscriptionId: currentSubscription?.stripe_subscription_id || null,
    status: pendingSubscription.status,
    plan: buildStoredPlanCode(normalizedPlanKey, normalizedBillingPeriod),
    currentPeriodEnd: pendingSubscription.currentPeriodEnd,
    trialEndsAt: pendingSubscription.trialEndsAt,
  });

  return session.url || null;
};

const resolveOrgIdForStripeEvent = async ({ metadataOrgId, customerId, subscriptionId }) => {
  if (metadataOrgId) return metadataOrgId;
  if (subscriptionId) {
    const bySub = await query("SELECT org_id FROM subscriptions WHERE stripe_subscription_id = $1", [subscriptionId]);
    if (bySub.rows[0]?.org_id) return bySub.rows[0].org_id;
  }
  if (customerId) {
    const byCustomer = await query("SELECT org_id FROM subscriptions WHERE stripe_customer_id = $1", [customerId]);
    if (byCustomer.rows[0]?.org_id) return byCustomer.rows[0].org_id;
  }
  return null;
};

const syncStripeSubscription = async (subscriptionLike, fallbackOrgId = null) => {
  const customerId = typeof subscriptionLike.customer === "string"
    ? subscriptionLike.customer
    : subscriptionLike.customer?.id;
  const subscriptionId = subscriptionLike.id || null;
  const metadataOrgId = subscriptionLike.metadata?.org_id || fallbackOrgId || null;
  const orgId = await resolveOrgIdForStripeEvent({ metadataOrgId, customerId, subscriptionId });
  if (!orgId) return false;

  const currentPeriodEnd = subscriptionLike.current_period_end
    ? new Date(Number(subscriptionLike.current_period_end) * 1000)
    : null;
  const trialEndsAt = subscriptionLike.trial_end
    ? new Date(Number(subscriptionLike.trial_end) * 1000)
    : null;
  const stripePriceId = subscriptionLike.items?.data?.[0]?.price?.id || subscriptionLike.plan?.id || null;
  const priceSelection = getSelectionForStripePriceId({ priceId: stripePriceId });
  const metadataPlanKey = normalizeBillingPlan(subscriptionLike.metadata?.plan_key);
  const metadataBillingPeriod = normalizeBillingPeriod(subscriptionLike.metadata?.billing_period) || DEFAULT_BILLING_PERIOD;
  const plan = priceSelection.planKey
    ? buildStoredPlanCode(priceSelection.planKey, priceSelection.billingPeriod)
    : metadataPlanKey
      ? buildStoredPlanCode(metadataPlanKey, metadataBillingPeriod)
      : null;

  await upsertSubscriptionFromStripe({
    orgId,
    customerId,
    subscriptionId,
    status: subscriptionLike.status || "inactive",
    plan,
    currentPeriodEnd,
    trialEndsAt,
  });
  return true;
};

const runTokenCleanup = async () => {
  try {
    await query("DELETE FROM magic_links WHERE expires_at < now() OR used_at IS NOT NULL");
    await query("DELETE FROM email_verification_tokens WHERE expires_at < now() OR used_at IS NOT NULL");
    await query("DELETE FROM password_reset_tokens WHERE expires_at < now() OR used_at IS NOT NULL");
    await query("DELETE FROM user_refresh_tokens WHERE expires_at < now() OR revoked_at IS NOT NULL");
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
  const smtpConfigured = Boolean(mailer && process.env.EMAIL_FROM);
  try {
    await query("SELECT 1 as ok");
    let smtp = { configured: smtpConfigured, ok: null };
    if (smtpConfigured) {
      try {
        await Promise.race([
          mailer.verify(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("smtp_verify_timeout")), 3000)),
        ]);
        smtp = { configured: true, ok: true };
      } catch (err) {
        smtp = { configured: true, ok: false, error: err?.code || err?.message || "smtp_unreachable" };
      }
    }

    if (smtpConfigured && smtp.ok === false) {
      return res.status(503).json({ ok: false, db: true, smtp, error: "smtp_unreachable", ...diagnostics });
    }

    res.json({ ok: true, db: true, smtp, ...diagnostics });
  } catch (err) {
    const msg = String(err?.message || "");
    const error = msg.includes("Missing DATABASE_URL") ? "db_not_configured" : "db_unreachable";
    res.status(503).json({ ok: false, db: false, smtp: { configured: smtpConfigured, ok: null }, error, ...diagnostics });
  }
});

app.get("/api/public/check-slug", async (req, res) => {
  const slug = normalizeSlugInput(req.query.slug);
  if (!isValidWorkspaceSlug(slug)) {
    return res.json({ available: false, error: "slug_invalid" });
  }
  const existing = await query("SELECT id FROM orgs WHERE slug = $1", [slug]);
  return res.json({ available: !existing.rows[0] });
});

app.post("/api/public/signup", authRateLimiter, async (req, res) => {
  const {
    business_name,
    workspace_slug,
    owner_name,
    email,
    password,
  } = req.body || {};
  const requestedPlanInput = req.body?.plan;
  const requestedBillingPeriodInput = req.body?.billing_period || req.body?.period;
  const requestedPlanKey = normalizeBillingPlan(requestedPlanInput) || DEFAULT_PLAN_KEY;
  const requestedBillingPeriod = normalizeBillingPeriod(requestedBillingPeriodInput) || DEFAULT_BILLING_PERIOD;
  const normalizedEmail = normalizeEmailInput(email);
  const ownerName = String(owner_name || "").trim();
  const orgName = deriveOrgNameFromIdentity({ companyName: business_name, displayName: ownerName, email: normalizedEmail });
  const desiredSlug = normalizeSlugInput(workspace_slug || deriveSlugFromName(orgName));

  if (hasOwn(req.body, "plan") && !normalizeBillingPlan(requestedPlanInput)) {
    return res.status(400).json({ error: "invalid_plan" });
  }
  if ((hasOwn(req.body, "billing_period") || hasOwn(req.body, "period")) && !normalizeBillingPeriod(requestedBillingPeriodInput)) {
    return res.status(400).json({ error: "invalid_billing_period" });
  }
  if (!orgName || !ownerName || !normalizedEmail || !password || !isValidWorkspaceSlug(desiredSlug)) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const slugExisting = await query("SELECT id FROM orgs WHERE slug = $1", [desiredSlug]);
  if (slugExisting.rows[0]) return res.status(400).json({ error: "slug_taken" });

  const passwordHash = await bcrypt.hash(String(password), 10);
  try {
    const { org, user, data } = await createOrgAndOwner({
      orgName,
      workspaceSlug: desiredSlug,
      ownerName,
      email: normalizedEmail,
      passwordHash,
      emailVerifiedAt: REQUIRE_EMAIL_VERIFICATION ? null : new Date(),
      initialPlanKey: requestedPlanKey,
      initialBillingPeriod: requestedBillingPeriod,
    });

    if (REQUIRE_EMAIL_VERIFICATION) {
      await sendEmailVerificationLink({ user, redirectUrl: APP_URL, correlationId: req.requestId });
    }

    const checkoutUrl = isPaidPlanKey(requestedPlanKey)
      ? await createCheckoutSessionForOrg({
          org,
          ownerUser: user,
          planKey: requestedPlanKey,
          billingPeriod: requestedBillingPeriod,
        })
      : null;
    const authResponse = await createAuthResponse(user, {
      data,
      workspace_slug: org.slug,
      billing_plan: requestedPlanKey,
      billing_period: requestedBillingPeriod,
      ...(checkoutUrl ? { checkout_url: checkoutUrl } : {}),
    });
    return res.json(authResponse);
  } catch (err) {
    if (err?.code === "email_in_use") return res.status(400).json({ error: "email_in_use" });
    if (err?.message === "slug_generation_failed") return res.status(400).json({ error: "slug_taken" });
    throw err;
  }
});

app.post("/api/auth/register", authRateLimiter, async (req, res) => {
  const { company_name, full_name, email, password, workspace_slug } = req.body || {};
  const trimmedName = String(full_name || "").trim();
  const normalizedEmail = normalizeEmailInput(email);
  if (!trimmedName || !normalizedEmail || !password) return res.status(400).json({ error: "missing_fields" });

  const orgName = deriveOrgNameFromIdentity({ companyName: company_name, displayName: trimmedName, email: normalizedEmail });
  const requestedSlug = normalizeSlugInput(workspace_slug || extractWorkspaceSlugFromRequest(req));
  const desiredSlug = isValidWorkspaceSlug(requestedSlug) ? requestedSlug : deriveSlugFromName(orgName);
  if (workspace_slug && !isValidWorkspaceSlug(desiredSlug)) return res.status(400).json({ error: "slug_invalid" });
  if (workspace_slug) {
    const slugExisting = await query("SELECT id FROM orgs WHERE slug = $1", [desiredSlug]);
    if (slugExisting.rows[0]) return res.status(400).json({ error: "slug_taken" });
  }
  const hash = await bcrypt.hash(String(password), 10);

  try {
    const { org, user, data } = await createOrgAndOwner({
      orgName,
      workspaceSlug: desiredSlug,
      ownerName: trimmedName,
      email: normalizedEmail,
      passwordHash: hash,
      emailVerifiedAt: REQUIRE_EMAIL_VERIFICATION ? null : new Date(),
    });

    if (REQUIRE_EMAIL_VERIFICATION) {
      await sendEmailVerificationLink({ user, redirectUrl: APP_URL, correlationId: req.requestId });
    }

    const authResponse = await createAuthResponse(user, {
      data,
      workspace_slug: org.slug,
    });
    res.json(authResponse);
  } catch (err) {
    if (err?.code === "email_in_use") return res.status(400).json({ error: "email_in_use" });
    throw err;
  }
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmailInput(email);
  const workspaceSlug = extractWorkspaceSlugFromRequest(req);
  if (!normalizedEmail || !password) return res.status(400).json({ error: "missing_fields" });

  const userRes = workspaceSlug
    ? await query(
      "SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.email = $1 AND o.slug = $2",
      [normalizedEmail, workspaceSlug]
    )
    : await query(
      "SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.email = $1",
      [normalizedEmail]
    );
  const user = userRes.rows[0];
  if (!user || !user.password_hash) return res.status(400).json({ error: "invalid_credentials" });
  if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at) {
    return res.status(403).json({ error: "email_verification_required" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: "invalid_credentials" });

  await ensureOrgSubscription(user.org_id);
  const authResponse = await createAuthResponse(user);
  res.json(authResponse);
});

app.post("/api/auth/refresh", async (req, res) => {
  const rawRefreshToken = String(req.body?.refresh_token || "").trim();
  if (!rawRefreshToken) return res.status(400).json({ error: "missing_token" });
  const user = await consumeRefreshToken(rawRefreshToken);
  if (!user) return res.status(401).json({ error: "invalid_token" });
  const authResponse = await createAuthResponse(user);
  res.json(authResponse);
});

app.post("/api/auth/password/request", authRateLimiter, async (req, res) => {
  const normalizedEmail = normalizeEmailInput(req.body?.email);
  const redirectUrl = req.body?.redirect_url;
  if (!normalizedEmail) return res.status(400).json({ error: "missing_email" });

  const userRes = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
  const user = userRes.rows[0];
  if (user) {
    await sendPasswordResetLink({ user, redirectUrl, correlationId: req.requestId });
  }
  res.json({ ok: true });
});

app.post("/api/auth/password/reset", authRateLimiter, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");
  if (!token || !password) return res.status(400).json({ error: "missing_fields" });

  const tokenHash = hashToken(token);
  const tokenRes = await query("SELECT * FROM password_reset_tokens WHERE token_hash = $1", [tokenHash]);
  const row = tokenRes.rows[0];
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: "invalid_token" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, row.user_id]);
  await query("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", [row.id]);
  res.json({ ok: true });
});

app.post("/api/auth/email/verify/request", authRateLimiter, async (req, res) => {
  let user = null;
  const authHeader = String(req.headers.authorization || "");
  if (authHeader.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const userRes = await query("SELECT * FROM users WHERE id = $1", [payload.userId]);
      user = userRes.rows[0] || null;
    } catch {
      user = null;
    }
  }
  if (!user) {
    const normalizedEmail = normalizeEmailInput(req.body?.email);
    if (normalizedEmail) {
      const userRes = await query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
      user = userRes.rows[0] || null;
    }
  }
  if (user) {
    await sendEmailVerificationLink({
      user,
      redirectUrl: req.body?.redirect_url,
      correlationId: req.requestId,
    });
  }
  res.json({ ok: true });
});

app.get("/api/auth/email/verify", async (req, res) => {
  const token = String(req.query.token || "").trim();
  const redirectUrl = resolveSafeRedirectUrl(req.query.redirect || APP_URL, APP_URL);
  if (!token) return res.status(400).send("Missing token");

  const tokenHash = hashToken(token);
  const tokenRes = await query("SELECT * FROM email_verification_tokens WHERE token_hash = $1", [tokenHash]);
  const row = tokenRes.rows[0];
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.redirect(`${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}verified=0`);
  }
  await query("UPDATE users SET email_verified_at = now() WHERE id = $1", [row.user_id]);
  await query("UPDATE email_verification_tokens SET used_at = now() WHERE id = $1", [row.id]);
  return res.redirect(`${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}verified=1`);
});

app.post("/api/auth/email/verify", async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ error: "missing_token" });
  const tokenHash = hashToken(token);
  const tokenRes = await query("SELECT * FROM email_verification_tokens WHERE token_hash = $1", [tokenHash]);
  const row = tokenRes.rows[0];
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: "invalid_token" });
  }
  await query("UPDATE users SET email_verified_at = now() WHERE id = $1", [row.user_id]);
  await query("UPDATE email_verification_tokens SET used_at = now() WHERE id = $1", [row.id]);
  res.json({ ok: true });
});

app.post("/api/auth/magic/request", authRateLimiter, async (req, res) => {
  const { email, redirect_url } = req.body || {};
  const normalizedEmail = normalizeEmailInput(email);
  const workspaceSlug = extractWorkspaceSlugFromRequest(req);
  if (!normalizedEmail) return res.status(400).json({ error: "missing_email" });

  const userRes = workspaceSlug
    ? await query(
      "SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.email = $1 AND o.slug = $2",
      [normalizedEmail, workspaceSlug]
    )
    : await query(
      "SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.email = $1",
      [normalizedEmail]
    );
  const user = userRes.rows[0];
  if (!user) return res.json({ ok: true });

  if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at) {
    await sendEmailVerificationLink({ user, redirectUrl: redirect_url, correlationId: req.requestId });
    return res.json({ ok: true });
  }

  const token = randomToken(32);
  const expires = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
  await query("INSERT INTO magic_links (user_id, token, expires_at) VALUES ($1,$2,$3)", [user.id, token, expires]);
  const safeRedirectUrl = resolveSafeRedirectUrl(redirect_url || APP_URL, APP_URL);
  const url = `${APP_URL}/api/auth/magic/verify?token=${token}&redirect=${encodeURIComponent(safeRedirectUrl)}`;
  sendEmailWithRetryInBackground({
    to: normalizedEmail,
    subject: "Your Shiftway login link",
    text: `Click to sign in: ${url}`,
    correlationId: req.requestId,
    emailType: "magic_link",
  });
  res.json({ ok: true });
});

app.get("/api/debug/email-last", auth, requireRole("owner", "manager"), async (req, res) => {
  if (!DEBUG_EMAIL_LAST_ENABLED) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true, email: lastEmailDeliveryDebug });
});

app.get("/api/auth/magic/verify", async (req, res) => {
  const { token, redirect } = req.query;
  if (!token) return res.status(400).send("Missing token");
  const linkRes = await query("SELECT * FROM magic_links WHERE token = $1", [token]);
  const link = linkRes.rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) return res.status(400).send("Invalid token");
  await query("UPDATE magic_links SET used_at = now() WHERE id = $1", [link.id]);
  const userRes = await query("SELECT * FROM users WHERE id = $1", [link.user_id]);
  const user = userRes.rows[0];
  if (!user) return res.status(400).send("Invalid token");
  if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at) return res.status(403).send("Email verification required");
  const jwtToken = signToken(user);
  const safeRedirectUrl = resolveSafeRedirectUrl(redirect || APP_URL, APP_URL);
  const sep = safeRedirectUrl.includes("?") ? "&" : "?";
  res.redirect(`${safeRedirectUrl}${sep}token=${encodeURIComponent(jwtToken)}`);
});

app.post("/api/auth/magic/verify", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "missing_token" });
  const linkRes = await query("SELECT * FROM magic_links WHERE token = $1", [token]);
  const link = linkRes.rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) return res.status(400).json({ error: "invalid_token" });
  await query("UPDATE magic_links SET used_at = now() WHERE id = $1", [link.id]);
  const userRes = await query("SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = $1", [link.user_id]);
  const user = userRes.rows[0];
  if (!user) return res.status(400).json({ error: "invalid_token" });
  if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified_at) return res.status(403).json({ error: "email_verification_required" });
  const authResponse = await createAuthResponse(user);
  res.json(authResponse);
});

app.get("/api/auth/google", (req, res, next) => {
  if (!passport._strategy("google")) return res.status(400).send("Google OAuth not configured");
  const redirectUrl = resolveSafeRedirectUrl(req.query.redirect || APP_URL, APP_URL);
  const statePayload = {
    redirectUrl,
    workspaceSlug: extractWorkspaceSlugFromRequest(req) || null,
    nonce: randomToken(8),
    exp: Date.now() + (GOOGLE_STATE_TTL_MINUTES * 60 * 1000),
  };
  const state = signStatePayload(statePayload);
  passport.authenticate("google", { scope: ["profile", "email"], state, session: false })(req, res, next);
});

app.get("/api/auth/google/callback", (req, res, next) => {
  const oauthState = verifyStatePayload(req.query.state);
  if (!oauthState) return res.redirect(APP_URL);
  req.oauthState = oauthState;

  passport.authenticate("google", { failureRedirect: APP_URL, session: false }, async (err, user) => {
    if (err || !user) return res.redirect(APP_URL);
    const freshUserRes = await query("SELECT u.*, o.slug AS org_slug FROM users u JOIN orgs o ON o.id = u.org_id WHERE u.id = $1", [user.id]);
    const freshUser = freshUserRes.rows[0];
    if (!freshUser) return res.redirect(APP_URL);
    if (oauthState.workspaceSlug && freshUser.org_slug !== oauthState.workspaceSlug) {
      return res.redirect(APP_URL);
    }

    await ensureOrgSubscription(freshUser.org_id);
    const authResponse = await createAuthResponse(freshUser);
    const safeRedirectUrl = resolveSafeRedirectUrl(oauthState.redirectUrl || APP_URL, APP_URL);
    const sep = safeRedirectUrl.includes("?") ? "&" : "?";
    res.redirect(`${safeRedirectUrl}${sep}token=${encodeURIComponent(authResponse.token)}`);
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
  const hasAttachments = hasOwn(payload, "attachments");
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
  const nextAttachments = hasAttachments
    ? (Array.isArray(payload.attachments) ? payload.attachments : []).map(normalizeAttachmentMeta).filter((attachment) => attachment.name)
    : (Array.isArray(previousStateUser.attachments) ? previousStateUser.attachments : []);
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
    attachments: nextAttachments,
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

app.delete("/api/me", auth, async (req, res) => {
  const currentPassword = String(req.body?.current_password || "");

  if (req.user.password_hash) {
    const passwordOk = await bcrypt.compare(currentPassword, req.user.password_hash);
    if (!passwordOk) return res.status(400).json({ error: "invalid_password" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (req.user.role === "owner") {
      const ownerCountRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE org_id = $1 AND role = 'owner'",
        [req.user.org_id]
      );
      const ownerCount = Number(ownerCountRes.rows[0]?.count || 0);
      if (ownerCount <= 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "last_owner" });
      }
    }

    const stateRes = await client.query("SELECT data FROM org_state WHERE org_id = $1 FOR UPDATE", [req.user.org_id]);
    if (stateRes.rows[0]) {
      const currentState = stateRes.rows[0].data || emptyOrgState();
      const nextState = removeUserFromOrgState(currentState, req.user.id);
      await client.query("UPDATE org_state SET data = $2, updated_at = now() WHERE org_id = $1", [req.user.org_id, nextState]);
    }

    const deletedUser = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [req.user.id]);
    if (!deletedUser.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "invalid_user" });
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure after route error
    }
    throw err;
  } finally {
    client.release();
  }
});

app.get("/api/billing/status", auth, async (req, res) => {
  const orgRes = await query("SELECT id, slug, name FROM orgs WHERE id = $1", [req.user.org_id]);
  const org = orgRes.rows[0];
  if (!org) return res.status(404).json({ error: "not_found" });
  const billing = await ensureOrgSubscription(req.user.org_id);
  const billingSelection = parseStoredPlanCode(billing?.plan);
  res.json({
    status: billing?.status || "inactive",
    plan: billingSelection.planKey || billing?.plan || null,
    billing_period: billingSelection.billingPeriod || null,
    trial_end: billing?.trial_ends_at || null,
    current_period_end: billing?.current_period_end || null,
    slug: org.slug || null,
  });
});

app.post("/api/billing/create-checkout-session", auth, requireRole("owner", "manager"), async (req, res) => {
  const orgRes = await query("SELECT id, slug, name FROM orgs WHERE id = $1", [req.user.org_id]);
  const org = orgRes.rows[0];
  if (!org) return res.status(404).json({ error: "not_found" });
  const requestedPlanInput = req.body?.plan;
  const requestedBillingPeriodInput = req.body?.billing_period || req.body?.period;
  const requestedPlanKey = normalizeBillingPlan(requestedPlanInput);
  const requestedBillingPeriod = normalizeBillingPeriod(requestedBillingPeriodInput);
  if (hasOwn(req.body, "plan") && !requestedPlanKey) {
    return res.status(400).json({ error: "invalid_plan" });
  }
  if (requestedPlanKey === FREE_PLAN_KEY) {
    return res.status(400).json({ error: "invalid_plan" });
  }
  if ((hasOwn(req.body, "billing_period") || hasOwn(req.body, "period")) && !requestedBillingPeriod) {
    return res.status(400).json({ error: "invalid_billing_period" });
  }

  const currentBilling = await ensureOrgSubscription(req.user.org_id);
  const currentSelection = parseStoredPlanCode(currentBilling?.plan);
  const planKey = requestedPlanKey || (isPaidPlanKey(currentSelection.planKey) ? currentSelection.planKey : DEFAULT_PLAN_KEY);
  const billingPeriod = requestedBillingPeriod || currentSelection.billingPeriod || DEFAULT_BILLING_PERIOD;

  const checkoutUrl = await createCheckoutSessionForOrg({
    org,
    ownerUser: req.user,
    planKey,
    billingPeriod,
  });
  if (!checkoutUrl) {
    return res.status(503).json({ error: "billing_not_configured" });
  }
  res.json({ checkout_url: checkoutUrl });
});

app.post("/api/billing/webhook", async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "billing_not_configured" });
  }
  const signature = req.headers["stripe-signature"];
  if (!signature || !req.rawBody) return res.status(400).json({ error: "invalid_signature" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: "invalid_signature", message: err?.message || "invalid_signature" });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncStripeSubscription(subscription, session.metadata?.org_id || null);
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
    const subscription = event.data.object;
    await syncStripeSubscription(subscription);
  }

  res.json({ received: true });
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
  if (typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "invalid_data" });
  if (!Array.isArray(data.locations) || !Array.isArray(data.users) || !Array.isArray(data.schedules)) {
    return res.status(400).json({ error: "invalid_data" });
  }
  const cleaned = { ...data };
  if (Array.isArray(cleaned.users)) {
    cleaned.users = cleaned.users.map((u) => ({ ...u, password: undefined }));
  }
  const serialized = JSON.stringify(cleaned);
  if (Buffer.byteLength(serialized, "utf8") > ORG_STATE_MAX_BYTES) {
    return res.status(413).json({ error: "payload_too_large" });
  }
  await query("INSERT INTO org_state (org_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (org_id) DO UPDATE SET data = $2, updated_at = now()", [req.user.org_id, cleaned]);
  res.json({ ok: true });
});

app.post("/api/users", auth, requireActiveSubscription, requireRole("manager", "owner"), async (req, res) => {
  const { full_name, email, role, location_id, password } = req.body || {};
  const trimmedName = String(full_name || "").trim();
  if (!trimmedName || !email) return res.status(400).json({ error: "missing_fields" });
  const normalizedEmail = normalizeEmailInput(email);
  if (!normalizedEmail) return res.status(400).json({ error: "missing_fields" });
  const existing = await query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (existing.rows[0]) return res.status(400).json({ error: "email_in_use" });

  const assignedRole = String(role || "employee").trim().toLowerCase();
  const allowedRoles = req.user.role === "owner"
    ? ["employee", "manager", "owner"]
    : ["employee", "manager"];
  if (!allowedRoles.includes(assignedRole)) {
    return res.status(403).json({ error: "forbidden" });
  }

  const resolvedLocationId = location_id || req.user.location_id;
  if (!resolvedLocationId) return res.status(400).json({ error: "missing_fields" });
  const locationRes = await query("SELECT id FROM locations WHERE id = $1 AND org_id = $2", [resolvedLocationId, req.user.org_id]);
  if (!locationRes.rows[0]) return res.status(404).json({ error: "not_found" });

  const hash = password ? await bcrypt.hash(password, 10) : null;
  const userRes = await query(
    "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active, email_verified_at) VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING *",
    [req.user.org_id, resolvedLocationId, trimmedName, normalizedEmail, hash, assignedRole, REQUIRE_EMAIL_VERIFICATION ? null : new Date()]
  );
  if (REQUIRE_EMAIL_VERIFICATION) {
    await sendEmailVerificationLink({ user: userRes.rows[0], redirectUrl: APP_URL, correlationId: req.requestId });
  }
  res.json({ user: sanitizeUser(userRes.rows[0]) });
});

app.get("/api/push/public-key", auth, requireActiveSubscription, async (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
});

app.post("/api/push/subscribe", auth, requireActiveSubscription, async (req, res) => {
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
  const usersRes = await query(
    "SELECT id, email FROM users WHERE org_id = $1 AND id = ANY($2)",
    [req.user.org_id, user_ids]
  );
  if (usersRes.rows.length !== user_ids.length) {
    return res.status(403).json({ error: "forbidden" });
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
       WHERE u.org_id = $1 AND ps.user_id = ANY($2)`,
      [req.user.org_id, user_ids]
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
    sendEmailWithRetryInBackground({
      to: normalizedEmail,
      subject: "You have been invited to Shiftway",
      text: message,
      correlationId: req.requestId,
      emailType: "invite",
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
  });
});

app.post("/api/invite/accept", async (req, res) => {
  const { token, password, full_name } = req.body || {};
  const inviteToken = String(token || "").trim();
  const trimmedName = String(full_name || "").trim();
  const rawPassword = String(password || "");

  if (!inviteToken) return res.status(400).json({ error: "missing_token" });
  if (!trimmedName || !rawPassword) return res.status(400).json({ error: "missing_fields" });

  const invite = await getInviteByToken(inviteToken);
  if (!invite || invite.error) return res.status(400).json({ error: "invalid_invite" });

  const passwordHash = await bcrypt.hash(rawPassword, 10);
  const fallbackEmail = `invite+${invite.id}@phone.shiftway.local`;
  const userEmail = String(invite.email || fallbackEmail).toLowerCase();

  const client = pool ? await pool.connect() : null;
  if (!client) {
    throw new Error(
      "Missing DATABASE_URL. Create server/.env from server/.env.example and set DATABASE_URL (Postgres connection string)."
    );
  }

  try {
    await client.query("BEGIN");

    const existingUserRes = await client.query("SELECT id FROM users WHERE email = $1", [userEmail]);
    if (existingUserRes.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "email_in_use" });
    }

    const userRes = await client.query(
      "INSERT INTO users (org_id, location_id, full_name, email, password_hash, role, is_active, email_verified_at) VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING *",
      [invite.org_id, invite.location_id, trimmedName, userEmail, passwordHash, invite.role, invite.email ? new Date() : null]
    );
    const user = userRes.rows[0];

    await client.query("UPDATE invites SET accepted_at = now() WHERE id = $1", [invite.id]);

    const stateRes = await client.query("SELECT data FROM org_state WHERE org_id = $1", [invite.org_id]);
    const state = stateRes.rows[0]?.data || emptyOrgState();
    const nextUsers = Array.isArray(state.users) ? [...state.users] : [];
    nextUsers.push({
      id: user.id,
      location_id: user.location_id,
      full_name: user.full_name,
      email: invite.email || "",
      role: user.role,
      is_active: user.is_active,
      phone: invite.phone || "",
      birthday: "",
      pronouns: "",
      emergency_contact: { name: "", phone: "" },
      attachments: [],
      notes: "",
      wage: "",
    });
    const nextState = { ...emptyOrgState(), ...state, users: nextUsers };

    await client.query(
      "INSERT INTO org_state (org_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (org_id) DO UPDATE SET data = $2, updated_at = now()",
      [invite.org_id, nextState]
    );

    await client.query("COMMIT");

    const authResponse = await createAuthResponse(user);
    res.json(authResponse);
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
