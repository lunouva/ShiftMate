import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead.jsx";
import MarketingShell from "../components/marketing/MarketingShell.jsx";

const planCards = [
  {
    name: "Starter",
    audience: "Best for first teams and single-workspace rollouts",
    price: "$29",
    priceNote: "per month, per workspace",
    badge: "Most teams start here",
    featured: true,
    ctaLabel: "Start free trial",
    ctaTo: "/signup",
    secondaryLabel: "View product pages",
    secondaryTo: "/product",
    highlights: [
      "14-day free trial before billing starts",
      "Unlimited employees in one workspace",
      "Weekly schedule builder, publishing, and copy-last-week tools",
      "Open shifts, shift swaps, time-off requests, and availability workflows",
      "Tasks, messages, newsfeed updates, and role-based access",
      "Labor cost visibility, CSV exports, and push or email notifications",
    ],
    footer: "Built so the first paid tier already covers the core operating loop instead of forcing teams into an upgrade just to run the schedule.",
  },
  {
    name: "Business",
    audience: "For growing teams with multiple managers, approvals, or rollout complexity",
    price: "Custom",
    priceNote: "scoped to team shape and rollout needs",
    badge: "Growth path",
    featured: false,
    ctaLabel: "Talk to sales",
    ctaTo: "/contact-us",
    secondaryLabel: "Read FAQs",
    secondaryTo: "/resources/faqs",
    highlights: [
      "Everything in Starter",
      "Structured rollout help for larger teams and added locations",
      "Annual billing conversations and custom onboarding support",
      "Migration planning when you are replacing spreadsheets or fragmented tools",
      "A clearer path for manager-heavy operations and approval workflows",
      "Commercial terms matched to operating complexity instead of guesswork",
    ],
    footer: "Research showed the second tier should unlock scale and coordination, not basic scheduling. That is how Business is positioned here.",
  },
  {
    name: "Enterprise",
    audience: "For procurement-led buyers and high-governance rollouts",
    price: "Custom",
    priceNote: "contracted rollout and governance support",
    badge: "Governance",
    featured: false,
    ctaLabel: "Contact Shiftway",
    ctaTo: "/contact-us",
    secondaryLabel: "Review security",
    secondaryTo: "/resources/security",
    highlights: [
      "Everything in Business",
      "Security and procurement review support during evaluation",
      "Implementation planning for larger org structures",
      "Custom commercial terms and rollout timelines",
      "A direct path for policy, access, and governance conversations",
      "Priority coordination for teams that need a sales-led motion",
    ],
    footer: "Enterprise exists for governance, rollout control, and buying process complexity, which mirrors the pattern the research found across the market.",
  },
];

const pricingPrinciples = [
  {
    title: "Put the operating loop in the first tier",
    body: "The research consistently showed that teams expect the first paid plan to handle the real day-to-day work: scheduling, requests, communication, and reporting.",
  },
  {
    title: "Keep limits explicit",
    body: "Instead of hiding what changes between plans, the page now makes the self-serve boundary clear and pushes scale conversations into Business and Enterprise.",
  },
  {
    title: "Make growth about complexity, not basics",
    body: "Higher tiers are framed around rollout, approvals, and governance because that is where competitors usually create the biggest jump in value.",
  },
];

const marketSignals = [
  {
    stat: "$2.50-$9",
    label: "Common workforce scheduling entry band",
    note: "Low per-user pricing is common, but core workflows are often split across tiers.",
  },
  {
    stat: "$12-$20",
    label: "Typical SMB scheduling starter band",
    note: "Many tools use this range to unlock reminders, integrations, and monetization basics.",
  },
  {
    stat: "$49+",
    label: "Ops-heavy per-location pricing jump",
    note: "Higher flat pricing usually shows up when multi-staff operations and risk controls become central.",
  },
];

const comparisonRows = [
  {
    label: "Self-serve signup",
    values: ["Included", "Talk to us", "Talk to us"],
  },
  {
    label: "14-day free trial",
    values: ["Included", "Included in rollout planning", "Included in evaluation planning"],
  },
  {
    label: "Unlimited employees in one workspace",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Schedule publishing, open shifts, swaps, and requests",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Tasks, messages, announcements, and role-based access",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Labor cost visibility and CSV exports",
    values: ["Included", "Included", "Included"],
  },
  {
    label: "Multi-manager or multi-location rollout help",
    values: ["-", "Included", "Included"],
  },
  {
    label: "Annual terms and custom commercial structure",
    values: ["-", "Included", "Included"],
  },
  {
    label: "Security review and procurement support",
    values: ["-", "Available", "Included"],
  },
];

const faqs = [
  {
    question: "Why is Shiftway centered on one public self-serve plan?",
    answer:
      "The research showed that the first paid tier needs to cover the core workflow clearly. Starter is priced to be the simple entry point, while Business and Enterprise are reserved for rollout, governance, and buying-process complexity.",
  },
  {
    question: "Do you offer a free plan?",
    answer:
      "Today the public motion is a 14-day free trial instead of a forever-free tier. That keeps evaluation simple while still letting teams test the full Starter workflow before paying.",
  },
  {
    question: "When should we talk to sales?",
    answer:
      "Talk to us when you need help structuring a larger rollout, want annual terms, expect procurement review, or need pricing shaped around multiple managers or locations.",
  },
  {
    question: "Are Business and Enterprise separate checkout plans today?",
    answer:
      "They are growth paths rather than separate public checkout buttons. The page uses them to set expectations around how Shiftway handles scale, onboarding, and governance conversations.",
  },
];

function PlanCard({ plan }) {
  return (
    <section
      className={`relative overflow-hidden rounded-[2rem] border p-8 shadow-sm ${
        plan.featured
          ? "border-brand-dark bg-brand-darker text-white shadow-xl"
          : "border-brand-light bg-white text-brand-text"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-28 ${
          plan.featured
            ? "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.22),_transparent_62%)]"
            : "bg-[radial-gradient(circle_at_top,_rgba(130,200,229,0.18),_transparent_62%)]"
        }`}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${plan.featured ? "text-white/70" : "text-brand-dark/60"}`}>
              {plan.name}
            </p>
            <h2 className={`mt-3 text-4xl font-black ${plan.featured ? "text-white" : "text-brand-text"}`}>{plan.price}</h2>
            <p className={`mt-2 text-sm leading-6 ${plan.featured ? "text-white/80" : "text-brand-dark/80"}`}>{plan.priceNote}</p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              plan.featured ? "bg-white/10 text-white" : "bg-brand-lightest text-brand-dark"
            }`}
          >
            {plan.badge}
          </div>
        </div>

        <p className={`mt-6 max-w-md text-sm leading-6 ${plan.featured ? "text-white/80" : "text-brand-dark/80"}`}>{plan.audience}</p>

        <ul className="mt-8 space-y-3">
          {plan.highlights.map((highlight) => (
            <li
              key={highlight}
              className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
                plan.featured
                  ? "border-white/10 bg-white/10 text-white/90"
                  : "border-brand-light bg-brand-lightest/60 text-brand-dark/80"
              }`}
            >
              {highlight}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to={plan.ctaTo}
            className={`rounded-xl px-5 py-3 text-center text-sm font-semibold transition ${
              plan.featured
                ? "bg-white text-brand-darker hover:bg-brand-lightest"
                : "border border-brand-dark bg-brand-dark text-white hover:bg-brand-darker"
            }`}
          >
            {plan.ctaLabel}
          </Link>
          <Link
            to={plan.secondaryTo}
            className={`rounded-xl border px-5 py-3 text-center text-sm font-semibold transition ${
              plan.featured
                ? "border-white/20 bg-white/5 text-white hover:bg-white/10"
                : "border-brand-light bg-white text-brand-dark hover:border-brand hover:bg-brand-lightest"
            }`}
          >
            {plan.secondaryLabel}
          </Link>
        </div>

        <p className={`mt-6 text-sm leading-6 ${plan.featured ? "text-white/70" : "text-brand-dark/70"}`}>{plan.footer}</p>
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <MarketingShell>
      <SeoHead
        title="Pricing | Shiftway"
        description="Research-driven Shiftway pricing with a 14-day free trial, a transparent Starter plan, and custom growth paths for scaling teams."
        path="/pricing"
      />

      <main>
        <section className="relative overflow-hidden border-b border-brand-light bg-[radial-gradient(circle_at_top_left,_rgba(130,200,229,0.42),_transparent_38%),linear-gradient(180deg,#ffffff_0%,#eef8fc_100%)]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full border border-brand-light bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark shadow-sm">
                Pricing redesigned from the research
              </div>
              <h1 className="mt-6 text-5xl font-black leading-tight text-brand-text md:text-6xl">
                Pricing that keeps the core workflow in the first paid tier.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-brand-dark/80">
                The market pattern was clear: buyers want transparent limits, visible upgrade logic, and a first tier that already handles the real work. Shiftway now leads with that structure.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="rounded-[2rem] border border-brand-dark bg-brand-darker p-6 text-white shadow-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Public buying path</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {[
                    { title: "14-day trial", copy: "No credit card required to start evaluating the workflow." },
                    { title: "Transparent entry point", copy: "One public Starter plan keeps the first buying decision simple." },
                    { title: "Clear growth path", copy: "Business and Enterprise are reserved for rollout and governance complexity." },
                  ].map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                      <div className="text-sm font-semibold">{item.title}</div>
                      <p className="mt-2 text-sm leading-6 text-white/75">{item.copy}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-brand-light bg-white/90 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Why it is packaged this way</p>
                <div className="mt-4 space-y-3">
                  {pricingPrinciples.map((principle) => (
                    <div key={principle.title} className="rounded-2xl border border-brand-light bg-brand-lightest/60 p-4">
                      <h2 className="text-base font-black text-brand-text">{principle.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-brand-dark/75">{principle.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Pricing overview</p>
              <h2 className="mt-3 text-3xl font-black text-brand-text md:text-4xl">A simple self-serve start, then structured growth paths.</h2>
            </div>
            <div className="rounded-2xl border border-brand-light bg-brand-lightest/60 px-4 py-3 text-sm leading-6 text-brand-dark/80">
              Starter matches the current trial and billing flow. Business and Enterprise are presented as honest next steps, not fake checkout buttons.
            </div>
          </div>

          <div className="mt-10 grid gap-6 xl:grid-cols-3">
            {planCards.map((plan) => (
              <PlanCard key={plan.name} plan={plan} />
            ))}
          </div>
        </section>

        <section className="border-y border-brand-light bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Comparison</p>
                <h2 className="mt-3 text-3xl font-black text-brand-text">What changes between plans should be obvious at a glance.</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-brand-dark/80">
                  The report showed that competitors win trust when they publish the step-up clearly. This table keeps the basics in Starter and moves rollout, contract, and governance complexity into the higher paths.
                </p>
              </div>

              <div className="rounded-[2rem] border border-brand-light bg-brand-lightest/60 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Research signal</p>
                <p className="mt-3 text-lg font-black text-brand-text">Higher tiers should unlock scale and governance, not basic scheduling.</p>
                <p className="mt-3 text-sm leading-6 text-brand-dark/75">
                  That is why Shiftway keeps scheduling, requests, messaging, and exports inside Starter instead of using them as upgrade bait.
                </p>
              </div>
            </div>

            <div className="mt-8 overflow-x-auto rounded-[2rem] border border-brand-light bg-white shadow-sm">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-brand-lightest/75 text-brand-text">
                  <tr>
                    <th className="px-5 py-4 font-black">Capability</th>
                    <th className="px-5 py-4 font-black">Starter</th>
                    <th className="px-5 py-4 font-black">Business</th>
                    <th className="px-5 py-4 font-black">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, index) => (
                    <tr key={row.label} className={index % 2 === 0 ? "bg-white" : "bg-brand-lightest/40"}>
                      <td className="px-5 py-4 font-semibold text-brand-text">{row.label}</td>
                      {row.values.map((value, valueIndex) => (
                        <td key={`${row.label}-${valueIndex}`} className="px-5 py-4 text-brand-dark/80">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-dark/60">Market framing</p>
              <h2 className="mt-3 text-3xl font-black text-brand-text">What the research said the market expects.</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {marketSignals.map((signal) => (
                  <div key={signal.label} className="rounded-2xl border border-brand-light bg-brand-lightest/50 p-4">
                    <div className="text-3xl font-black text-brand-text">{signal.stat}</div>
                    <div className="mt-2 text-sm font-semibold text-brand-dark">{signal.label}</div>
                    <p className="mt-2 text-sm leading-6 text-brand-dark/75">{signal.note}</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 text-sm leading-7 text-brand-dark/80">
                Shiftway uses those signals to keep public pricing straightforward: one Starter plan for immediate adoption, then custom paths once a buyer is optimizing for rollout, org complexity, or governance.
              </p>
            </div>

            <div className="rounded-[2rem] border border-brand-light bg-brand-darker p-8 text-white shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">FAQ</p>
              <div className="mt-6 space-y-4">
                {faqs.map((faq) => (
                  <div key={faq.question} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <h2 className="text-base font-black text-white">{faq.question}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/75">{faq.answer}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-brand-darker transition hover:bg-brand-lightest"
                >
                  Start the trial
                </Link>
                <Link
                  to="/contact-us"
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Talk through pricing
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
