import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, TOKEN_KEY } from "../lib/api.js";
import { trackMarketingEvent } from "../lib/analytics.js";
import { buildWorkspaceUrl } from "../lib/subdomain.js";
import {
  DEFAULT_BILLING_PERIOD,
  DEFAULT_PLAN_KEY,
  buildSignupPath,
  getDisplayedPlanPrice,
  getPlanByKey,
  normalizeBillingPeriod,
  normalizePlanKey,
} from "../lib/pricing.js";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$|^[a-z0-9]{3,}$/;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export default function SignupPage() {
  const [searchParams] = useSearchParams();
  const selectedPlanKey = normalizePlanKey(searchParams.get("plan")) || DEFAULT_PLAN_KEY;
  const selectedBillingPeriod = normalizeBillingPeriod(searchParams.get("billing_period") || searchParams.get("period")) || DEFAULT_BILLING_PERIOD;
  const selectedPlan = getPlanByKey(selectedPlanKey);
  const selectedPrice = getDisplayedPlanPrice(selectedPlanKey, selectedBillingPeriod);
  const isEnterprise = selectedPlan?.key === "enterprise";
  const [form, setForm] = useState({
    business_name: "",
    workspace_slug: "",
    owner_name: "",
    email: "",
    password: "",
  });
  const [slugStatus, setSlugStatus] = useState(null);
  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const slugCheckTimer = useRef(null);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!slugManual && form.business_name) {
      setField("workspace_slug", slugify(form.business_name));
    }
  }, [form.business_name, slugManual]);

  useEffect(() => {
    const slug = form.workspace_slug;
    if (!slug) {
      setSlugStatus(null);
      return;
    }

    if (!SLUG_REGEX.test(slug)) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    clearTimeout(slugCheckTimer.current);
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/public/check-slug?slug=${encodeURIComponent(slug)}`);
        setSlugStatus(res?.available ? "available" : "taken");
      } catch {
        setSlugStatus(null);
      }
    }, 500);

    return () => clearTimeout(slugCheckTimer.current);
  }, [form.workspace_slug]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const { business_name, workspace_slug, owner_name, email, password } = form;
    if (!business_name.trim() || !workspace_slug.trim() || !owner_name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (!SLUG_REGEX.test(workspace_slug)) {
      setError("Workspace URL can only contain lowercase letters, numbers, and hyphens (minimum 3 characters).");
      return;
    }
    if (slugStatus === "taken") {
      setError("That workspace URL is already taken. Please choose another.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/public/signup", {
        method: "POST",
        body: {
          business_name: business_name.trim(),
          workspace_slug: workspace_slug.trim(),
          owner_name: owner_name.trim(),
          email: email.trim(),
          password,
          plan: selectedPlanKey,
          billing_period: selectedBillingPeriod,
        },
      });

      if (res?.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
      }

      if (selectedPlan?.trialEligible) {
        trackMarketingEvent("trial_start", {
          plan: selectedPlanKey,
          billing_period: selectedBillingPeriod,
        });
      }

      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }

      if (res?.workspace_slug || workspace_slug) {
        const slug = res?.workspace_slug || workspace_slug;
        window.location.href = buildWorkspaceUrl(slug);
      }
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const slugStatusElement = (() => {
    if (!form.workspace_slug) return null;
    if (slugStatus === "checking") return <span className="text-xs text-brand-dark/70">Checking...</span>;
    if (slugStatus === "available") return <span className="text-xs font-semibold text-green-600">Available</span>;
    if (slugStatus === "taken") return <span className="text-xs font-semibold text-red-600">Already taken</span>;
    if (slugStatus === "invalid") return <span className="text-xs text-amber-600">Only lowercase letters, numbers, and hyphens are allowed.</span>;
    return null;
  })();

  const appDomain = import.meta.env.VITE_APP_DOMAIN || "shiftway.app";
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const useSubdomainWorkspaces = import.meta.env.VITE_ENABLE_SUBDOMAIN_WORKSPACES === "1";
  const workspaceSuffix = isLocalhost || useSubdomainWorkspaces ? (isLocalhost ? "?org=" : `.${appDomain}`) : "";
  const workspaceExample = useSubdomainWorkspaces
    ? `https://your-slug.${appDomain}`
    : `https://${appDomain}/app?org=your-slug`;

  if (isEnterprise) {
    return (
      <div className="min-h-screen bg-brand-lightest">
        <nav className="flex items-center justify-between border-b border-brand-light bg-white px-6 py-4">
          <Link to="/" className="text-xl font-black text-brand-text">Shiftway</Link>
          <Link to="/pricing" className="text-sm font-medium text-brand-dark transition hover:text-brand-darker">Pricing</Link>
        </nav>
        <div className="mx-auto flex min-h-[calc(100vh-73px)] max-w-3xl items-center justify-center px-6 py-12">
          <div className="w-full rounded-[2rem] border border-brand-light bg-white p-8 shadow-lg">
            <div className="inline-flex rounded-full border border-brand-light bg-brand-lightest px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark">
              Enterprise plan
            </div>
            <h1 className="mt-5 text-4xl font-black text-brand-text">Enterprise starts with a sales conversation.</h1>
            <p className="mt-4 text-sm leading-7 text-brand-dark/80">
              Enterprise is reserved for procurement, security review, rollout planning, and custom commercials. The pricing page keeps that path explicit instead of pushing it through the self-serve signup form.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/contact-us"
                className="rounded-xl border border-brand-dark bg-brand-dark px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-darker"
              >
                Contact Sales
              </Link>
              <Link
                to="/pricing"
                className="rounded-xl border border-brand-light bg-white px-5 py-3 text-center text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
              >
                Back to pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-lightest">
      <nav className="flex items-center justify-between border-b border-brand-light bg-white px-6 py-4">
        <Link to="/" className="text-xl font-black text-brand-text">Shiftway</Link>
        <Link to="/pricing" className="text-sm font-medium text-brand-dark transition hover:text-brand-darker">Pricing</Link>
      </nav>

      <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)] lg:items-center">
        <div className="rounded-[2rem] border border-brand-light bg-[linear-gradient(180deg,#ffffff_0%,#eef8fc_100%)] p-8 shadow-sm">
          <div className="inline-flex rounded-full border border-brand-light bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark">
            Selected plan
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-brand-text">{selectedPlan.name}</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-brand-dark/80">{selectedPlan.description}</p>
            </div>
            <div className="rounded-[1.5rem] border border-brand-light bg-white px-5 py-4 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">
                {selectedBillingPeriod === "yearly" ? "Yearly billing" : "Monthly billing"}
              </div>
              <div className="mt-2 text-3xl font-black text-brand-text">{selectedPrice.priceLabel}</div>
              {selectedPrice.priceSuffix ? <div className="mt-1 text-sm text-brand-dark/80">{selectedPrice.priceSuffix}</div> : null}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-brand-light bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Included</div>
              <div className="mt-3 text-lg font-black text-brand-text">{selectedPlan.employeeLimit}</div>
              <div className="mt-1 text-sm text-brand-dark/75">{selectedPlan.locationLimit}</div>
            </div>
            <div className="rounded-[1.5rem] border border-brand-light bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">Billing note</div>
              <div className="mt-3 text-sm leading-7 text-brand-dark/80">{selectedPrice.billingNote}</div>
            </div>
          </div>

          <ul className="mt-8 space-y-3">
            {selectedPlan.highlights.map((highlight) => (
              <li key={highlight} className="rounded-[1.25rem] border border-brand-light bg-white px-4 py-3 text-sm leading-6 text-brand-dark/80 shadow-sm">
                {highlight}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/pricing"
              className="rounded-xl border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
            >
              Change plan
            </Link>
            {selectedPlan.key === "pro" ? (
              <Link
                to={buildSignupPath("core", selectedBillingPeriod)}
                className="rounded-xl border border-brand-light bg-white px-4 py-2 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
              >
                Compare Core
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-black text-brand-text">Create your workspace</h2>
          <p className="mt-2 text-sm text-brand-dark/70">
            {selectedPlan.trialEligible
              ? "Create your account to start the trial and continue into billing when you are ready."
              : "Set up your team in minutes and upgrade when you need more employees or locations."}
          </p>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-brand-text">Business name</span>
              <input
                type="text"
                required
                value={form.business_name}
                onChange={(event) => setField("business_name", event.target.value)}
                placeholder="Cold Stone Creamery"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-brand-text">Workspace URL</span>
              <div className="mt-1.5 flex items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <input
                  type="text"
                  required
                  value={form.workspace_slug}
                  onChange={(event) => {
                    setSlugManual(true);
                    setField(
                      "workspace_slug",
                      event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 63)
                    );
                  }}
                  placeholder="cold-stone"
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                />
                {workspaceSuffix ? (
                  <span className="shrink-0 pr-3 text-xs text-gray-400">{workspaceSuffix}</span>
                ) : null}
              </div>
              <div className="mt-1 h-4">{slugStatusElement}</div>
              {!isLocalhost && !useSubdomainWorkspaces ? (
                <p className="mt-1 text-xs text-brand-dark/60">
                  Workspace URL: {workspaceExample.replace("your-slug", form.workspace_slug || "your-slug")}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-brand-text">Your name</span>
              <input
                type="text"
                required
                value={form.owner_name}
                onChange={(event) => setField("owner_name", event.target.value)}
                placeholder="Jane Smith"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-brand-text">Email</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                placeholder="jane@example.com"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-brand-text">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                placeholder="Minimum 8 characters"
                className="mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || slugStatus === "taken" || slugStatus === "invalid"}
              className="mt-2 w-full rounded-xl border border-brand-dark bg-brand-dark py-2.5 text-sm font-bold text-white transition hover:bg-brand-darker disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creating workspace..." : selectedPlan.ctaLabel}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-brand-dark/60">
            {selectedPlan.trialEligible
              ? "Core and Pro start with a free trial before the paid subscription takes over."
              : "Free includes one location and up to five employees."}
          </p>

          <p className="mt-3 text-center text-xs text-brand-dark/70">
            Already have a workspace?{" "}
            <Link to="/app" className="text-brand-dark underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
