import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, TOKEN_KEY } from '../lib/api.js';
import { MarketingHeader } from '../components/marketing/MarketingShell.jsx';
import { buildWorkspaceUrl } from '../lib/subdomain.js';

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$|^[a-z0-9]{3,}$/;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

export default function SignupPage() {
  const [form, setForm] = useState({
    business_name: '',
    workspace_slug: '',
    owner_name: '',
    email: '',
    password: '',
  });
  const [slugStatus, setSlugStatus] = useState(null);
  const [slugManual, setSlugManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const slugCheckTimer = useRef(null);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!slugManual && form.business_name) {
      setField('workspace_slug', slugify(form.business_name));
    }
  }, [form.business_name, slugManual]);

  useEffect(() => {
    const slug = form.workspace_slug;
    if (!slug) {
      setSlugStatus(null);
      return;
    }

    if (!SLUG_REGEX.test(slug)) {
      setSlugStatus('invalid');
      return;
    }

    setSlugStatus('checking');
    clearTimeout(slugCheckTimer.current);
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/public/check-slug?slug=${encodeURIComponent(slug)}`);
        setSlugStatus(res?.available ? 'available' : 'taken');
      } catch {
        setSlugStatus(null);
      }
    }, 500);

    return () => clearTimeout(slugCheckTimer.current);
  }, [form.workspace_slug]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const { business_name, workspace_slug, owner_name, email, password } = form;
    if (!business_name.trim() || !workspace_slug.trim() || !owner_name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!SLUG_REGEX.test(workspace_slug)) {
      setError('Workspace URL can only contain lowercase letters, numbers, and hyphens (min 3 characters).');
      return;
    }
    if (slugStatus === 'taken') {
      setError('That workspace URL is already taken. Please choose another.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/public/signup', {
        method: 'POST',
        body: {
          business_name: business_name.trim(),
          workspace_slug: workspace_slug.trim(),
          owner_name: owner_name.trim(),
          email: email.trim(),
          password,
        },
      });

      if (res?.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
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
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const slugStatusEl = (() => {
    if (!form.workspace_slug) return null;
    if (slugStatus === 'checking') return <span className="text-xs text-brand-dark/70">Checking...</span>;
    if (slugStatus === 'available') return <span className="text-xs font-semibold text-green-600">Available</span>;
    if (slugStatus === 'taken') return <span className="text-xs font-semibold text-red-600">Already taken</span>;
    if (slugStatus === 'invalid') return <span className="text-xs text-amber-600">Only lowercase letters, numbers, hyphens (min 3 chars)</span>;
    return null;
  })();

  const appDomain = import.meta.env.VITE_APP_DOMAIN || 'shiftway.app';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const useSubdomainWorkspaces = import.meta.env.VITE_ENABLE_SUBDOMAIN_WORKSPACES === '1';
  const workspaceSuffix = isLocalhost || useSubdomainWorkspaces ? (isLocalhost ? '?org=' : `.${appDomain}`) : '';
  const workspaceExample = useSubdomainWorkspaces
    ? `https://your-slug.${appDomain}`
    : `https://${appDomain}/app?org=your-slug`;

  return (
    <div className="min-h-screen bg-brand-lightest flex flex-col">
      <MarketingHeader variant="checkout" />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="rounded-[2rem] border border-brand-light bg-white p-8 shadow-lg">
            <h1 className="mb-1 text-2xl font-black text-brand-text">Create your workspace</h1>
            <p className="mb-6 text-sm text-brand-dark/70">Set up your team in minutes.</p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-brand-text">Business name</span>
                <input
                  type="text"
                  required
                  value={form.business_name}
                  onChange={(event) => setField('business_name', event.target.value)}
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
                        'workspace_slug',
                        event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+/, '').slice(0, 63)
                      );
                    }}
                    placeholder="cold-stone"
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                  />
                  {workspaceSuffix ? (
                    <span className="shrink-0 pr-3 text-xs text-gray-400">{workspaceSuffix}</span>
                  ) : null}
                </div>
                <div className="mt-1 h-4">{slugStatusEl}</div>
                {!isLocalhost && !useSubdomainWorkspaces ? (
                  <p className="mt-1 text-xs text-brand-dark/60">
                    Workspace URL: {workspaceExample.replace('your-slug', form.workspace_slug || 'your-slug')}
                  </p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-brand-text">Your name</span>
                <input
                  type="text"
                  required
                  value={form.owner_name}
                  onChange={(event) => setField('owner_name', event.target.value)}
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
                  onChange={(event) => setField('email', event.target.value)}
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
                  onChange={(event) => setField('password', event.target.value)}
                  placeholder="Min. 8 characters"
                  className="mt-1.5 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || slugStatus === 'taken' || slugStatus === 'invalid'}
                className="mt-2 w-full rounded-xl border border-brand-dark bg-brand-dark py-2.5 text-sm font-bold text-white transition hover:bg-brand-darker disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating workspace...' : 'Create workspace'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-brand-dark/60">
              14-day free trial. No credit card required to start.
            </p>

            <p className="mt-3 text-center text-xs text-brand-dark/70">
              Already have a workspace?{' '}
              <Link to="/app" className="text-brand-dark underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
