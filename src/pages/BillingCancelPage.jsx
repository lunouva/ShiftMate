import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingHeader } from '../components/marketing/MarketingShell.jsx';

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen bg-brand-lightest flex flex-col">
      <MarketingHeader variant="checkout" />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-brand-light bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-xl font-black text-amber-700">
            STOP
          </div>

          <h1 className="mb-2 text-2xl font-black text-brand-text">Checkout canceled</h1>
          <p className="mb-6 text-sm text-brand-dark/80">
            No worries. Nothing was charged. Your workspace details are safe and waiting whenever you're ready.
          </p>

          <div className="mb-6 rounded-xl border border-brand-light bg-brand-lightest p-4 text-sm text-brand-dark/80">
            <strong>No data was lost.</strong> If you already created an account, it is still there. Just complete checkout to activate your workspace.
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/signup"
              className="block w-full rounded-xl bg-brand-dark py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-darker"
            >
              Try again
            </Link>
            <Link
              to="/pricing"
              className="block w-full rounded-xl border border-brand-light bg-white py-2.5 text-center text-sm font-semibold text-brand-dark transition hover:border-brand hover:bg-brand-lightest"
            >
              View pricing
            </Link>
            <Link to="/" className="text-sm text-brand-dark/60 transition hover:text-brand-dark">
              Back to home
            </Link>
          </div>

          <div className="mt-6 border-t border-brand-light pt-4">
            <p className="text-xs text-brand-dark/50">
              Questions?{' '}
              <a href="mailto:hello@shiftway.app" className="underline">
                hello@shiftway.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
