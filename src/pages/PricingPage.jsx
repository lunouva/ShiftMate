import React from 'react';
import { Link } from 'react-router-dom';

const CHECK = <span className="text-green-500 font-bold">✓</span>;
const CROSS = <span className="text-gray-300 font-bold">✗</span>;

const STARTER_FEATURES = [
  [true,  'Visual weekly schedule builder'],
  [true,  'Up to 15 employees'],
  [true,  'Time-off requests & approvals'],
  [true,  'Push & email notifications'],
  [false, 'Shift swaps & open shift claims'],
  [false, 'Employee messaging & newsfeed'],
  [false, 'Tasks & shift notes'],
  [false, 'CSV & payroll export'],
];

const PRO_FEATURES = [
  [true, 'Unlimited employees'],
  [true, 'Visual weekly schedule builder'],
  [true, 'Shift swaps & open shift claims'],
  [true, 'Time-off requests & approvals'],
  [true, 'Employee messaging & newsfeed'],
  [true, 'Tasks & shift notes'],
  [true, 'CSV & payroll export'],
  [true, 'Push & email notifications'],
  [true, 'Dedicated workspace URL'],
];

const BUSINESS_FEATURES = [
  [true, 'Everything in Professional'],
  [true, 'Priority email & chat support'],
  [true, 'Custom onboarding session'],
  [true, 'Multi-location dashboard'],
  [true, 'SLA guarantee'],
  [true, 'Dedicated account manager'],
];

function FeatureList({ features }) {
  return (
    <ul className="text-sm text-left space-y-2.5 mb-8">
      {features.map(([included, label]) => (
        <li key={label} className="flex items-center gap-3">
          {included ? CHECK : CROSS}
          <span className={included ? '' : 'text-gray-400'}>{label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-brand-lightest">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-brand-light bg-white">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand via-brand-dark to-brand-darker text-base font-black text-white shadow">
            ✦
          </div>
          <span className="text-xl font-black text-brand-text">Shiftway</span>
        </Link>
        <Link
          to="/signup"
          className="rounded-xl border border-brand-dark bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-darker"
        >
          Get started
        </Link>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="text-4xl font-black text-brand-text mb-4">Pick your plan. Upgrade as you grow.</h1>
        <p className="text-brand-dark/80 mb-12">Start free, no credit card required. Scale when you're ready.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Starter */}
          <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-sm flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-2">Starter</div>
            <div className="text-5xl font-black text-brand-text mb-1">Free</div>
            <div className="text-sm text-brand-dark/70 mb-6">forever, 1 location</div>

            <FeatureList features={STARTER_FEATURES} />

            <div className="mt-auto">
              <Link
                to="/signup?plan=starter"
                className="block w-full rounded-xl border border-brand-dark py-3 text-sm font-bold text-brand-dark text-center transition hover:bg-brand-lightest"
              >
                Get started free
              </Link>
              <p className="mt-3 text-xs text-brand-dark/60">No credit card required.</p>
            </div>
          </div>

          {/* Professional */}
          <div className="rounded-[2rem] border-2 border-brand-dark bg-white p-8 shadow-xl relative flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-dark text-white text-xs font-bold px-4 py-1 rounded-full tracking-wide">
              Most Popular
            </div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-2">Professional</div>
            <div className="text-5xl font-black text-brand-text mb-1">$29</div>
            <div className="text-sm text-brand-dark/70 mb-6">per month, per location</div>

            <FeatureList features={PRO_FEATURES} />

            <div className="mt-auto">
              <Link
                to="/signup?plan=professional"
                className="block w-full rounded-xl bg-brand-dark py-3 text-sm font-bold text-white text-center transition hover:bg-brand-darker"
              >
                Start free trial
              </Link>
              <p className="mt-3 text-xs text-brand-dark/60">14-day free trial. Cancel anytime.</p>
            </div>
          </div>

          {/* Business */}
          <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-sm flex flex-col">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-2">Business</div>
            <div className="text-5xl font-black text-brand-text mb-1">$79</div>
            <div className="text-sm text-brand-dark/70 mb-6">per month, per location</div>

            <FeatureList features={BUSINESS_FEATURES} />

            <div className="mt-auto">
              <a
                href="mailto:hello@shiftway.app"
                className="block w-full rounded-xl border border-brand-dark py-3 text-sm font-bold text-brand-dark text-center transition hover:bg-brand-lightest"
              >
                Contact us
              </a>
              <p className="mt-3 text-xs text-brand-dark/60">Custom onboarding included.</p>
            </div>
          </div>

        </div>

        <p className="mt-12 text-sm text-brand-dark/70">
          Questions? <a href="mailto:hello@shiftway.app" className="text-brand-dark underline">Contact us</a>
        </p>
      </main>

      <footer className="text-center py-8 text-xs text-brand-dark/50">
        © {new Date().getFullYear()} Shiftway. All rights reserved.
      </footer>
    </div>
  );
}
