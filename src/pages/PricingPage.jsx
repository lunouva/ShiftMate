import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import MarketingShell from "../components/marketing/MarketingShell.jsx";
import { trackMarketingEvent } from "../lib/analytics.js";
import {
  PLAN_ORDER,
  YEARLY_DISCOUNT,
  buildSignupPath,
  comparisonRows,
  getDisplayedPlanPrice,
  getPlanByKey,
} from "../lib/pricing.js";

const heroStats = [
  {
    label: "Launch path",
    value: "Free to Enterprise",
    detail: "A clear ladder from small-team testing to procurement-led rollout.",
  },
  {
    label: "Yearly savings",
    value: "20% off",
    detail: "Annual billing lowers the per-location cost without changing plan limits.",
  },
  {
    label: "Best fit",
    value: "Pro",
    detail: "Highlighted for multi-location operators who need analytics and API access.",
  },
];

const roiDrivers = [
  {
    title: "Manager time reclaimed",
    stat: "8 hrs",
    body: "A 25-person location can recover hours otherwise spent fixing swaps, re-texting schedules, and rebuilding weekly coverage.",
  },
  {
    title: "Monthly labor lift",
    stat: "$1,260",
    body: "Modeled from reduced overtime gaps, faster refill on open shifts, and fewer manual admin hours every month.",
  },
  {
    title: "Time to value",
    stat: "< 30 days",
    body: "Teams usually feel the first payoff once swaps, alerts, and publishing stop living in separate tools.",
  },
];

const testimonials = [
  {
    quote: "The weekly schedule finally stopped living in a spreadsheet and six text threads.",
    role: "Restaurant GM",
    context: "Representative operator feedback from the research",
  },
  {
    quote: "Pro is where the product starts feeling like an operating system instead of a single scheduling screen.",
    role: "Retail Ops Lead",
    context: "Representative buyer language from the research",
  },
  {
    quote: "The pricing ladder makes sense because the higher plans unlock coordination and data, not the basics.",
    role: "Multi-location Director",
    context: "Representative buying criteria from the research",
  },
];

const faqItems = [
  {
    question: "What does yearly billing change?",
    answer: "Yearly billing keeps the same employee and location limits while lowering the per-location price by 20 percent.",
  },
  {
    question: "When should a team move from Core to Pro?",
    answer: "Core is built for one-location or lightly growing teams. Pro is the right step once you need API access, advanced analytics, and stronger forecasting across more operators.",
  },
  {
    question: "What happens if we outgrow our employee limit?",
    answer: "You can upgrade at any time. Limits are designed as a clean packaging boundary, not a trap, so the next plan is the intended path once your team size changes.",
  },
  {
    question: "Why is Enterprise still custom?",
    answer: "Enterprise is for teams with procurement, rollout, or security review requirements that need custom commercials and implementation planning.",
  },
];

function PriceToggle({ billingPeriod, onChange }) {
  return (
    <div className="inline-flex rounded-full border border-brand-light bg-white p-1 shadow-sm">
      {[
        { key: "monthly", label: "Monthly", note: null },
        { key: "yearly", label: "Yearly", note: `Save ${Math.round(YEARLY_DISCOUNT * 100)}%` },
      ].map((option) => {
        const active = billingPeriod === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-brand-darker text-white shadow"
                : "text-brand-dark hover:bg-brand-lightest"
            }`}
          >
            {option.label}
            {option.note ? <span className={`ml-2 text-xs ${active ? "text-white/80" : "text-brand-dark/70"}`}>{option.note}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({ billingPeriod, planKey, onPlanClick }) {
  const plan = getPlanByKey(planKey);
  const price = getDisplayedPlanPrice(planKey, billingPeriod);
  const ctaTo = plan.key === "enterprise" ? "/contact-us" : buildSignupPath(plan.key, billingPeriod);

  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border p-7 shadow-sm transition duration-200 ${
        plan.featured
          ? "border-brand-dark bg-brand-darker text-white shadow-xl"
          : "border-brand-light bg-white text-brand-text hover:-translate-y-1 hover:shadow-lg"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-32 ${
          plan.featured
            ? "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.24),_transparent_62%)]"
            : "bg-[radial-gradient(circle_at_top,_rgba(130,200,229,0.2),_transparent_62%)]"
        }`}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${plan.featured ? "text-white/70" : "text-brand-dark/60"}`}>
              {plan.name}
            </p>
            <h2 className={`mt-4 text-4xl font-black ${plan.featured ? "text-white" : "text-brand-text"}`}>{price.priceLabel}</h2>
            {price.priceSuffix ? (
              <p className={`mt-2 text-sm ${plan.featured ? "text-white/80" : "text-brand-dark/80"}`}>{price.priceSuffix}</p>
            ) : null}
          </div>
          {plan.badge ? (
            <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${plan.featured ? "bg-white text-brand-darker" : "bg-brand-lightest text-brand-dark"}`}>
              {plan.badge}
            </div>
          ) : null}
        </div>

        <p className={`mt-5 text-sm leading-6 ${plan.featured ? "text-white/80" : "text-brand-dark/80"}`}>{plan.description}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[plan.employeeLimit, plan.locationLimit].map((item) => (
            <div
              key={item}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
                plan.featured
                  ? "border-white/15 bg-white/10 text-white"
                  : "border-brand-light bg-brand-lightest/60 text-brand-text"
              }`}
            >
              {item}
            </div>
          ))}
        </div>

        <ul className="mt-6 space-y-3">
          {plan.highlights.map((highlight) => (
            <li
              key={highlight}
              className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                plan.featured
                  ? "border-white/10 bg-white/10 text-white/90"
                  : "border-brand-light bg-white text-brand-dark/80"
              }`}
            >
              {highlight}
            </li>
          ))}
        </ul>

        <p className={`mt-5 text-sm leading-6 ${plan.featured ? "text-white/70" : "text-brand-dark/70"}`}>{price.billingNote}</p>

        <Link
          to={ctaTo}
          onClick={() => onPlanClick(plan)}
          className={`mt-7 block rounded-xl px-5 py-3 text-center text-sm font-semibold transition ${
            plan.featured
              ? "bg-white text-brand-darker hover:bg-brand-lightest"
              : plan.ctaVariant === "dark"
                ? "border border-brand-dark bg-brand-dark text-white hover:bg-brand-darker"
                : plan.ctaVariant === "primary"
                  ? "border border-brand-dark bg-brand-dark text-white hover:bg-brand-darker"
                  : "border border-brand-light bg-brand-lightest text-brand-darker hover:border-brand hover:bg-white"
          }`}
        >
          {plan.ctaLabel}
        </Link>
      </div>
    </section>
  );
}

function MobileComparison() {
  return (
    <div className="space-y-3 md:hidden">
      {comparisonRows.map((row) => (
        <details key={row.key} className="group rounded-[1.5rem] border border-brand-light bg-white p-5 shadow-sm">
          <summary className="cursor-pointer list-none pr-8 text-base font-black text-brand-text">
            <div className="flex items-center justify-between gap-3">
              <span>{row.label}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60 transition group-open:rotate-45">+</span>
            </div>
          </summary>
          <div className="mt-4 grid gap-3">
            {PLAN_ORDER.map((planKey) => {
              const plan = getPlanByKey(planKey);
              return (
                <div key={`${row.key}-${planKey}`} className="rounded-2xl border border-brand-light bg-brand-lightest/50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/60">{plan.name}</div>
                  <div className="mt-1 text-sm font-semibold text-brand-text">{row.values[planKey]}</div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState("monthly");
  const trackedView = useRef(false);

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    trackMarketingEvent("pricing_view", {
      billing_period: billingPeriod,
      page_name: "pricing",
    });
  }, [billingPeriod]);

  const handlePlanClick = (plan) => {
    trackMarketingEvent("plan_click", {
      plan: plan.key,
      billing_period: plan.key === "free" ? null : billingPeriod,
      cta_label: plan.ctaLabel,
    });
  };

  return (
    <MarketingShell>
      <SeoHead
        title="Pricing | Shiftway"
        description="Compare Shiftway Free, Core, Pro, and Enterprise plans with monthly or yearly billing and a modern SaaS pricing structure."
        path="/pricing"
      />

      <main>
        <section className="relative overflow-hidden border-b border-brand-light bg-[radial-gradient(circle_at_top_left,_rgba(130,200,229,0.44),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#eef8fc_100%)]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full border border-brand-light bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark shadow-sm">
                Modern SaaS pricing architecture
              </div>
              <h1 className="mt-6 text-5xl font-black leading-tight text-brand-text md:text-6xl">
                Pricing built for small teams, growing operators, and enterprise rollouts.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-brand-dark/80">
                Shiftway now uses a four-tier ladder with a cleaner free entry point, a clear self-serve growth path, and a highlighted Pro plan for multi-location teams.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to={buildSignupPath("free")}
                  onClick={() => handlePlanClick(getPlanByKey("free"))}
                  className="rounded-xl border border-brand-dark bg-brand-dark px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-darker"
                >
                  Start Free
                </Link>
                <a
                  href="#pricing"
                  className="rounded-xl border border-brand-light bg-white px-5 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
                >
                  Compare plans
                </a>
              </div>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {heroStats.map((item) => (
                <div key={item.label} className="rounded-[1.75rem] border border-brand-light bg-white/85 p-6 shadow-sm backdrop-blur">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">{item.label}</div>
                  <div className="mt-3 text-3xl font-black text-brand-text">{item.value}</div>
                  <p className="mt-2 text-sm leading-6 text-brand-dark/75">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Pricing</p>
              <h2 className="mt-3 text-3xl font-black text-brand-text md:text-4xl">Choose the plan that matches your team shape and operating complexity.</h2>
              <p className="mt-4 text-sm leading-7 text-brand-dark/80">
                Free gets a small team into the product fast. Core and Pro are the self-serve revenue tiers. Enterprise stays sales-led for procurement, rollout, and custom requirements.
              </p>
            </div>
            <PriceToggle billingPeriod={billingPeriod} onChange={setBillingPeriod} />
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((planKey) => (
              <PlanCard key={planKey} billingPeriod={billingPeriod} planKey={planKey} onPlanClick={handlePlanClick} />
            ))}
          </div>
        </section>

        <section className="border-y border-brand-light bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Feature comparison</p>
                <h2 className="mt-3 text-3xl font-black text-brand-text">Every step up should feel intentional.</h2>
                <p className="mt-4 text-sm leading-7 text-brand-dark/80">
                  The packaging now keeps basic scheduling accessible, then layers in communication, forecasting, integrations, API access, and analytics as teams grow.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-brand-light bg-brand-lightest/70 px-5 py-4 text-sm leading-6 text-brand-dark/80">
                Mobile view switches this table into expandable sections so the plan differences stay readable on small screens.
              </div>
            </div>

            <div className="mt-8 hidden overflow-x-auto rounded-[2rem] border border-brand-light bg-white shadow-sm md:block">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-brand-lightest/80 text-brand-text">
                  <tr>
                    <th className="px-5 py-4 font-black">Feature</th>
                    {PLAN_ORDER.map((planKey) => (
                      <th key={`head-${planKey}`} className="px-5 py-4 font-black">
                        {getPlanByKey(planKey).name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, index) => (
                    <tr key={row.key} className={index % 2 === 0 ? "bg-white" : "bg-brand-lightest/35"}>
                      <td className="px-5 py-4 font-semibold text-brand-text">{row.label}</td>
                      {PLAN_ORDER.map((planKey) => (
                        <td key={`${row.key}-${planKey}`} className="px-5 py-4 text-brand-dark/80">
                          {row.values[planKey]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8">
              <MobileComparison />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-[2rem] border border-brand-light bg-brand-darker p-8 text-white shadow-xl">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">ROI savings</p>
              <h2 className="mt-3 text-3xl font-black">Pricing is small compared with the admin time and labor waste it replaces.</h2>
              <p className="mt-4 text-sm leading-7 text-white/75">
                These are modeled savings blocks for the kind of operator this pricing page targets. The goal is to show how quickly even Core can pay back once the weekly workflow is centralized.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {roiDrivers.map((driver) => (
                <div key={driver.title} className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">{driver.title}</div>
                  <div className="mt-3 text-4xl font-black text-white">{driver.stat}</div>
                  <p className="mt-3 text-sm leading-6 text-white/75">{driver.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-brand-light bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfe_100%)]">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Testimonials</p>
              <h2 className="mt-3 text-3xl font-black text-brand-text">Representative buyer language from the pricing research.</h2>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {testimonials.map((item) => (
                <div key={item.quote} className="rounded-[2rem] border border-brand-light bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold leading-8 text-brand-text">"{item.quote}"</p>
                  <div className="mt-5 text-sm font-black text-brand-dark">{item.role}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-dark/55">{item.context}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">FAQ</p>
              <h2 className="mt-3 text-3xl font-black text-brand-text">Questions buyers usually ask before they start.</h2>

              <div className="mt-8 space-y-3">
                {faqItems.map((faq) => (
                  <details key={faq.question} className="group rounded-[1.5rem] border border-brand-light bg-white p-5 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-black text-brand-text">
                      <span>{faq.question}</span>
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark/55 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-brand-dark/80">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-brand-light bg-brand-lightest/70 p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Next step</p>
              <h3 className="mt-3 text-2xl font-black text-brand-text">Start free, start a trial, or talk to sales.</h3>
              <p className="mt-4 text-sm leading-7 text-brand-dark/80">
                The architecture is simple on purpose: Free for first use, Core and Pro for self-serve growth, Enterprise for a sales-led process.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Link
                  to={buildSignupPath("free")}
                  onClick={() => handlePlanClick(getPlanByKey("free"))}
                  className="rounded-xl border border-brand-dark bg-brand-dark px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-darker"
                >
                  Start Free
                </Link>
                <Link
                  to={buildSignupPath("pro", billingPeriod)}
                  onClick={() => handlePlanClick(getPlanByKey("pro"))}
                  className="rounded-xl border border-brand-light bg-white px-5 py-3 text-center text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
                >
                  Start Pro Trial
                </Link>
                <Link
                  to="/contact-us"
                  onClick={() => handlePlanClick(getPlanByKey("enterprise"))}
                  className="rounded-xl border border-brand-light bg-white px-5 py-3 text-center text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
                >
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
