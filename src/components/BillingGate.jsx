import React, { useState } from 'react';
import { apiFetch, TOKEN_KEY } from '../lib/api.js';

/**
 * BillingGate — shown when the API returns HTTP 402 (billing_required).
 * Owners/managers can reactivate. Employees see a contact-manager message.
 */
export default function BillingGate({ currentUser, onDismiss, clientSettings }) {
  const isOwnerOrManager = currentUser?.role === 'owner' || currentUser?.role === 'manager';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReactivate = async () => {
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await apiFetch(
        '/api/billing/create-checkout-session',
        { token, method: 'POST' },
        clientSettings
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        setError('Could not create a checkout session. Please try again or contact support.');
      }
    } catch (err) {
      setError(err.message || 'Unable to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-brand-light bg-white p-8 shadow-2xl text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">
          🔒
        </div>

        <h2 className="text-xl font-black text-brand-text mb-2">Subscription required</h2>

        {isOwnerOrManager ? (
          <>
            <p className="text-sm text-brand-dark/80 mb-6">
              Your workspace subscription is inactive. Reactivate to restore full access for your team.
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleReactivate}
                disabled={loading}
                className="w-full rounded-xl bg-brand-dark py-2.5 text-sm font-bold text-white transition hover:bg-brand-darker disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Reactivate subscription →'}
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-sm text-brand-dark/60 hover:text-brand-dark transition"
                >
                  Sign out
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-brand-dark/80 mb-6">
              Your workspace subscription is currently inactive. Please contact your manager or owner to reactivate access.
            </p>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="w-full rounded-xl border border-brand-light bg-brand-lightest py-2.5 text-sm font-semibold text-brand-dark transition hover:bg-brand-light"
              >
                Sign out
              </button>
            )}
          </>
        )}

        <p className="mt-4 text-xs text-brand-dark/40">
          Need help? <a href="mailto:hello@shiftway.app" className="underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}
