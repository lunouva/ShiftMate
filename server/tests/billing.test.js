import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_BILLING_PERIOD,
  DEFAULT_PLAN_KEY,
  appendQueryParams,
  buildStoredPlanCode,
  getSelectionForStripePriceId,
  getStripePriceIdForSelection,
  parseStoredPlanCode,
} from "../src/billing.js";

test("buildStoredPlanCode keeps free as a standalone plan", () => {
  assert.equal(buildStoredPlanCode("free", "yearly"), "free");
});

test("buildStoredPlanCode and parseStoredPlanCode round-trip paid plans", () => {
  const stored = buildStoredPlanCode("pro", "yearly");
  assert.equal(stored, "pro_yearly");
  assert.deepEqual(parseStoredPlanCode(stored), {
    planKey: "pro",
    billingPeriod: "yearly",
    raw: "pro_yearly",
  });
});

test("parseStoredPlanCode normalizes legacy starter records", () => {
  assert.deepEqual(parseStoredPlanCode("starter"), {
    planKey: DEFAULT_PLAN_KEY,
    billingPeriod: DEFAULT_BILLING_PERIOD,
    raw: "starter",
  });
});

test("getStripePriceIdForSelection resolves plan-specific ids with a legacy fallback", () => {
  const env = {
    STRIPE_PRICE_ID: "price_legacy_core",
    STRIPE_PRICE_ID_PRO_YEARLY: "price_pro_yearly",
  };

  assert.equal(
    getStripePriceIdForSelection({ planKey: "core", billingPeriod: "monthly", env }),
    "price_legacy_core"
  );
  assert.equal(
    getStripePriceIdForSelection({ planKey: "pro", billingPeriod: "yearly", env }),
    "price_pro_yearly"
  );
});

test("getSelectionForStripePriceId maps price ids back to plan selection", () => {
  const env = {
    STRIPE_PRICE_ID_CORE_MONTHLY: "price_core_monthly",
    STRIPE_PRICE_ID_PRO_YEARLY: "price_pro_yearly",
  };

  assert.deepEqual(getSelectionForStripePriceId({ priceId: "price_core_monthly", env }), {
    planKey: "core",
    billingPeriod: "monthly",
  });
  assert.deepEqual(getSelectionForStripePriceId({ priceId: "price_pro_yearly", env }), {
    planKey: "pro",
    billingPeriod: "yearly",
  });
});

test("appendQueryParams preserves existing query strings", () => {
  assert.equal(
    appendQueryParams("https://shiftway.app/billing/cancel?org=demo", {
      plan: "pro",
      billing_period: "yearly",
    }),
    "https://shiftway.app/billing/cancel?org=demo&plan=pro&billing_period=yearly"
  );
});
