import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  DEFAULT_BILLING_PERIOD,
  DEFAULT_PLAN_KEY,
  buildSignupPath,
  normalizeBillingPeriod,
  normalizePlanKey,
} from "../lib/pricing.js";

export default function BillingCancelPage() {
  const [searchParams] = useSearchParams();
  const planKey = normalizePlanKey(searchParams.get("plan")) || DEFAULT_PLAN_KEY;
  const billingPeriod = normalizeBillingPeriod(searchParams.get("billing_period")) || DEFAULT_BILLING_PERIOD;
  const retryPath = buildSignupPath(planKey, billingPeriod);

  return (
    <div className="min-h-screen bg-brand-lightest flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[2rem] border border-brand-light bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl">
          X
        </div>

        <h1 className="text-2xl font-black text-brand-text mb-2">Checkout canceled</h1>
        <p className="text-sm text-brand-dark/80 mb-6">
          Nothing was charged. Your workspace setup is still there whenever you want to continue.
        </p>

        <div className="rounded-xl border border-brand-light bg-brand-lightest p-4 text-sm text-brand-dark/80 mb-6">
          <strong>No data was lost.</strong> Finish checkout whenever you are ready and keep moving with the same plan selection.
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to={retryPath}
            className="block w-full rounded-xl bg-brand-dark py-2.5 text-sm font-bold text-white text-center transition hover:bg-brand-darker"
          >
            Try again
          </Link>
          <Link
            to="/pricing"
            className="block w-full rounded-xl border border-brand-light bg-white py-2.5 text-sm font-semibold text-brand-dark text-center transition hover:border-brand hover:bg-brand-lightest"
          >
            View pricing
          </Link>
          <Link
            to="/"
            className="text-sm text-brand-dark/60 hover:text-brand-dark transition"
          >
            Back to home
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-brand-light">
          <p className="text-xs text-brand-dark/50">
            Questions? <a href="mailto:hello@shiftway.app" className="underline">hello@shiftway.app</a>
          </p>
        </div>
      </div>
    </div>
  );
}
