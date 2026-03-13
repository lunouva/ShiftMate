export const DEFAULT_PLAN_KEY = "core";
export const FREE_PLAN_KEY = "free";
export const DEFAULT_BILLING_PERIOD = "monthly";
export const BILLING_PLAN_KEYS = ["free", "core", "pro", "enterprise"];
export const PAID_PLAN_KEYS = ["core", "pro", "enterprise"];

export function normalizeBillingPlan(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return BILLING_PLAN_KEYS.includes(normalized) ? normalized : null;
}

export function normalizeBillingPeriod(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "yearly" ? "yearly" : normalized === "monthly" ? "monthly" : null;
}

export function isPaidPlanKey(value) {
  const normalizedPlan = normalizeBillingPlan(value);
  return normalizedPlan ? PAID_PLAN_KEYS.includes(normalizedPlan) : false;
}

export function buildStoredPlanCode(planKey, billingPeriod = DEFAULT_BILLING_PERIOD) {
  const normalizedPlan = normalizeBillingPlan(planKey) || DEFAULT_PLAN_KEY;
  if (normalizedPlan === FREE_PLAN_KEY) return FREE_PLAN_KEY;
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod) || DEFAULT_BILLING_PERIOD;
  return `${normalizedPlan}_${normalizedBillingPeriod}`;
}

export function parseStoredPlanCode(storedPlan) {
  const raw = String(storedPlan || "").trim().toLowerCase();
  if (!raw) return { planKey: null, billingPeriod: null, raw: null };
  if (raw === "starter") {
    return { planKey: DEFAULT_PLAN_KEY, billingPeriod: DEFAULT_BILLING_PERIOD, raw };
  }

  const match = raw.match(/^(free|core|pro|enterprise)(?:_(monthly|yearly))?$/);
  if (!match) return { planKey: raw, billingPeriod: null, raw };
  return {
    planKey: match[1],
    billingPeriod: match[1] === FREE_PLAN_KEY ? null : (match[2] || DEFAULT_BILLING_PERIOD),
    raw,
  };
}

export function createPriceIdLookup(env = process.env) {
  return {
    free: {
      monthly: String(env.STRIPE_PRICE_ID_FREE_MONTHLY || env.STRIPE_PRICE_ID_FREE || "").trim(),
      yearly: String(env.STRIPE_PRICE_ID_FREE_YEARLY || "").trim(),
    },
    core: {
      monthly: String(env.STRIPE_PRICE_ID_CORE_MONTHLY || env.STRIPE_PRICE_ID || "").trim(),
      yearly: String(env.STRIPE_PRICE_ID_CORE_YEARLY || "").trim(),
    },
    pro: {
      monthly: String(env.STRIPE_PRICE_ID_PRO_MONTHLY || "").trim(),
      yearly: String(env.STRIPE_PRICE_ID_PRO_YEARLY || "").trim(),
    },
    enterprise: {
      monthly: String(env.STRIPE_PRICE_ID_ENTERPRISE_MONTHLY || "").trim(),
      yearly: String(env.STRIPE_PRICE_ID_ENTERPRISE_YEARLY || "").trim(),
    },
  };
}

export function getStripePriceIdForSelection({ planKey, billingPeriod = DEFAULT_BILLING_PERIOD, env = process.env }) {
  const normalizedPlan = normalizeBillingPlan(planKey);
  if (!normalizedPlan || normalizedPlan === FREE_PLAN_KEY) return "";
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod) || DEFAULT_BILLING_PERIOD;
  const lookup = createPriceIdLookup(env);
  const priceConfig = lookup[normalizedPlan] || {};
  return priceConfig[normalizedBillingPeriod] || priceConfig[DEFAULT_BILLING_PERIOD] || "";
}

export function getSelectionForStripePriceId({ priceId, env = process.env }) {
  const normalizedPriceId = String(priceId || "").trim();
  if (!normalizedPriceId) return { planKey: null, billingPeriod: null };

  const lookup = createPriceIdLookup(env);
  for (const planKey of BILLING_PLAN_KEYS) {
    const planLookup = lookup[planKey] || {};
    for (const billingPeriod of ["monthly", "yearly"]) {
      if (planLookup[billingPeriod] && planLookup[billingPeriod] === normalizedPriceId) {
        return {
          planKey,
          billingPeriod: planKey === FREE_PLAN_KEY ? null : billingPeriod,
        };
      }
    }
  }

  if (normalizedPriceId === String(env.STRIPE_PRICE_ID || "").trim()) {
    return {
      planKey: DEFAULT_PLAN_KEY,
      billingPeriod: DEFAULT_BILLING_PERIOD,
    };
  }

  return { planKey: null, billingPeriod: null };
}

export function appendQueryParams(urlValue, params = {}) {
  const url = new URL(urlValue);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
