export const PLAN_ORDER = ["free", "core", "pro", "enterprise"];
export const DEFAULT_PLAN_KEY = "core";
export const DEFAULT_BILLING_PERIOD = "monthly";
export const YEARLY_DISCOUNT = 0.2;

export const pricingPlans = {
  free: {
    key: "free",
    name: "Free",
    monthlyPrice: 0,
    employeeLimit: "5 employees",
    locationLimit: "1 location",
    description: "A light starter workspace for very small teams running one location.",
    featured: false,
    badge: null,
    ctaLabel: "Start Free",
    ctaVariant: "secondary",
    checkoutPlan: false,
    trialEligible: false,
    highlights: [
      "Weekly schedule builder",
      "Single location workspace",
      "Basic shift swaps",
      "Team messaging and announcements",
    ],
  },
  core: {
    key: "core",
    name: "Core",
    monthlyPrice: 29,
    employeeLimit: "25 employees",
    locationLimit: "Unlimited locations",
    description: "The self-serve operating plan for growing teams that need the full weekly workflow.",
    featured: false,
    badge: null,
    ctaLabel: "Start Free Trial",
    ctaVariant: "primary",
    checkoutPlan: true,
    trialEligible: true,
    highlights: [
      "Everything in Free",
      "SMS alerts and schedule reminders",
      "Forecasting and labor planning basics",
      "Standard integrations",
    ],
  },
  pro: {
    key: "pro",
    name: "Pro",
    monthlyPrice: 79,
    employeeLimit: "100 employees",
    locationLimit: "Unlimited locations",
    description: "For multi-location operators who want deeper insight, automation, and system connectivity.",
    featured: true,
    badge: "Most Popular",
    ctaLabel: "Start Free Trial",
    ctaVariant: "featured",
    checkoutPlan: true,
    trialEligible: true,
    highlights: [
      "Everything in Core",
      "API access",
      "Advanced analytics",
      "Priority integrations support",
    ],
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    employeeLimit: "Unlimited employees",
    locationLimit: "Unlimited locations",
    description: "Custom packaging for procurement, rollout support, and enterprise-grade controls.",
    featured: false,
    badge: null,
    ctaLabel: "Contact Sales",
    ctaVariant: "dark",
    checkoutPlan: false,
    trialEligible: false,
    highlights: [
      "Everything in Pro",
      "Custom rollout planning",
      "Security and procurement support",
      "Custom data and integration workflows",
    ],
  },
};

export const comparisonRows = [
  {
    key: "employees",
    label: "Employees",
    values: {
      free: "5",
      core: "25",
      pro: "100",
      enterprise: "Unlimited",
    },
  },
  {
    key: "locations",
    label: "Locations",
    values: {
      free: "1",
      core: "Unlimited billed per location",
      pro: "Unlimited billed per location",
      enterprise: "Unlimited",
    },
  },
  {
    key: "shift_swaps",
    label: "Shift swaps",
    values: {
      free: "Basic",
      core: "Included",
      pro: "Included",
      enterprise: "Advanced workflows",
    },
  },
  {
    key: "sms_alerts",
    label: "SMS alerts",
    values: {
      free: "No",
      core: "Included",
      pro: "Included",
      enterprise: "Custom policies",
    },
  },
  {
    key: "forecasting",
    label: "Forecasting",
    values: {
      free: "No",
      core: "Basic",
      pro: "Advanced",
      enterprise: "Custom planning",
    },
  },
  {
    key: "integrations",
    label: "Integrations",
    values: {
      free: "No",
      core: "Standard",
      pro: "Priority",
      enterprise: "Custom",
    },
  },
  {
    key: "api",
    label: "API",
    values: {
      free: "No",
      core: "No",
      pro: "Included",
      enterprise: "Extended access",
    },
  },
  {
    key: "advanced_analytics",
    label: "Advanced analytics",
    values: {
      free: "No",
      core: "No",
      pro: "Included",
      enterprise: "Custom reporting",
    },
  },
];

export function normalizePlanKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(pricingPlans, normalized) ? normalized : null;
}

export function normalizeBillingPeriod(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "yearly" ? "yearly" : normalized === "monthly" ? "monthly" : null;
}

export function getPlanByKey(planKey) {
  const normalized = normalizePlanKey(planKey);
  return normalized ? pricingPlans[normalized] : null;
}

export function formatUsd(amount, options = {}) {
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  const maximumFractionDigits = options.maximumFractionDigits ?? minimumFractionDigits;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
}

export function getYearlyEquivalentPrice(monthlyPrice) {
  return monthlyPrice * (1 - YEARLY_DISCOUNT);
}

export function getYearlyTotal(monthlyPrice) {
  return monthlyPrice * 12 * (1 - YEARLY_DISCOUNT);
}

export function getDisplayedPlanPrice(planKey, billingPeriod = DEFAULT_BILLING_PERIOD) {
  const plan = getPlanByKey(planKey);
  const normalizedPeriod = normalizeBillingPeriod(billingPeriod) || DEFAULT_BILLING_PERIOD;

  if (!plan) {
    return {
      priceLabel: "Custom",
      priceSuffix: "",
      billingNote: "",
    };
  }

  if (plan.monthlyPrice === null) {
    return {
      priceLabel: "Custom",
      priceSuffix: "pricing",
      billingNote: "Built around your rollout, locations, and integration needs.",
    };
  }

  if (plan.monthlyPrice === 0) {
    return {
      priceLabel: "$0",
      priceSuffix: "",
      billingNote: "Free forever for one location.",
    };
  }

  if (normalizedPeriod === "yearly") {
    const yearlyEquivalent = getYearlyEquivalentPrice(plan.monthlyPrice);
    const annualTotal = getYearlyTotal(plan.monthlyPrice);
    const hasPennies = yearlyEquivalent % 1 !== 0;
    return {
      priceLabel: formatUsd(yearlyEquivalent, {
        minimumFractionDigits: hasPennies ? 2 : 0,
        maximumFractionDigits: hasPennies ? 2 : 0,
      }),
      priceSuffix: "/ location / month",
      billingNote: `Billed annually at ${formatUsd(annualTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per location.`,
    };
  }

  return {
    priceLabel: formatUsd(plan.monthlyPrice),
    priceSuffix: "/ location / month",
    billingNote: "Billed monthly per active location.",
  };
}

export function buildSignupPath(planKey, billingPeriod = DEFAULT_BILLING_PERIOD) {
  const normalizedPlanKey = normalizePlanKey(planKey) || DEFAULT_PLAN_KEY;
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod) || DEFAULT_BILLING_PERIOD;
  const params = new URLSearchParams({ plan: normalizedPlanKey });
  if (normalizedPlanKey !== "free") {
    params.set("billing_period", normalizedBillingPeriod);
  }
  return `/signup?${params.toString()}`;
}
