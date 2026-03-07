import React from 'react';
import { Link } from 'react-router-dom';

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

      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-black text-brand-text mb-4">Simple, honest pricing</h1>
        <p className="text-brand-dark/80 mb-12">One plan. Everything included. No surprise fees.</p>

        <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-lg max-w-sm mx-auto">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-dark mb-2">Professional</div>
          <div className="text-5xl font-black text-brand-text mb-1">$29</div>
          <div className="text-sm text-brand-dark/70 mb-6">per month, per location</div>

          <ul className="text-sm text-left space-y-3 mb-8">
            {[
              'Unlimited employees',
              'Visual weekly schedule builder',
              'Shift swaps & open shift claims',
              'Time-off requests & approvals',
              'Employee messaging & newsfeed',
              'Tasks & shift notes',
              'CSV & payroll export',
              'Push & email notifications',
              'Dedicated workspace URL',
            ].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="text-green-500 font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/signup"
            className="block w-full rounded-xl bg-brand-dark py-3 text-sm font-bold text-white text-center transition hover:bg-brand-darker"
          >
            Start free trial
          </Link>
          <p className="mt-3 text-xs text-brand-dark/60">14-day free trial. Cancel anytime.</p>
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
