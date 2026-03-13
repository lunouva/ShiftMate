import React, { useEffect, useState } from 'react';
import { apiFetch, TOKEN_KEY } from '../lib/api.js';
import { MarketingHeader } from '../components/marketing/MarketingShell.jsx';
import { buildWorkspaceUrl } from '../lib/subdomain.js';

export default function BillingSuccessPage() {
  const [status, setStatus] = useState('loading');
  const [billingData, setBillingData] = useState(null);
  const [manualSlug, setManualSlug] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatus('ready');
      return;
    }

    apiFetch('/api/billing/status', { token })
      .then((res) => {
        setBillingData(res);
        setStatus('ready');
        if (res?.slug && (res?.status === 'active' || res?.status === 'trialing')) {
          const url = buildWorkspaceUrl(res.slug);
          setTimeout(() => {
            setRedirecting(true);
            window.location.href = url;
          }, 2500);
        }
      })
      .catch(() => {
        setStatus('ready');
      });
  }, []);

  const handleManualGo = () => {
    const slug = manualSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug) return;
    window.location.href = buildWorkspaceUrl(slug);
  };

  const slug = billingData?.slug;
  const workspaceUrl = slug ? buildWorkspaceUrl(slug) : null;

  return (
    <div className="min-h-screen bg-brand-lightest flex flex-col">
      <MarketingHeader variant="checkout" />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[2rem] border border-brand-light bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl">
            OK
          </div>

          <h1 className="mb-2 text-2xl font-black text-brand-text">You're all set!</h1>
          <p className="mb-6 text-sm text-brand-dark/80">
            Your Shiftway workspace is ready. Let's get your team scheduled.
          </p>

          {status === 'loading' && (
            <div className="animate-pulse rounded-xl border border-brand-light bg-brand-lightest p-4 text-sm text-brand-dark">
              Loading your workspace details...
            </div>
          )}

          {status === 'ready' && slug && (
            <div className="space-y-4">
              {redirecting ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  Taking you to your workspace...
                </div>
              ) : (
                <div className="rounded-xl border border-brand-light bg-brand-lightest p-4 text-left">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-dark/60">Your workspace</div>
                  <a href={workspaceUrl} className="break-all font-semibold text-brand-dark underline">
                    {workspaceUrl}
                  </a>
                </div>
              )}

              <a
                href={workspaceUrl}
                className="block w-full rounded-xl bg-brand-dark py-2.5 text-center text-sm font-bold text-white transition hover:bg-brand-darker"
              >
                Go to my workspace
              </a>
            </div>
          )}

          {status === 'ready' && !slug && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                We could not automatically detect your workspace. Enter your workspace name below to continue.
              </div>

              <div className="text-left">
                <label className="text-sm font-medium text-brand-text">Workspace name</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={manualSlug}
                    onChange={(event) => setManualSlug(event.target.value)}
                    placeholder="your-workspace"
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="button"
                    onClick={handleManualGo}
                    disabled={!manualSlug.trim()}
                    className="rounded-xl bg-brand-dark px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-darker disabled:opacity-60"
                  >
                    Go
                  </button>
                </div>
                <p className="mt-1 text-xs text-brand-dark/60">This is the slug you chose during signup.</p>
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-brand-light pt-4">
            <p className="text-xs text-brand-dark/50">
              Need help?{' '}
              <a href="mailto:hello@shiftway.app" className="underline">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
