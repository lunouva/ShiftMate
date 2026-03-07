/**
 * ShiftWay API client utilities.
 * Extracted from App.jsx so public pages can import them independently.
 */

export const TOKEN_KEY = 'shiftway_token';

export const getApiBase = (clientSettings) => {
  const fromSettings = clientSettings?.apiBase;
  if (fromSettings) return fromSettings;

  const fromEnv = import.meta.env.VITE_API_BASE;
  if (fromEnv) return fromEnv;

  const host = window?.location?.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  if (isLocalhost) return 'http://localhost:4000';
  return window.location.origin;
};

const friendlyApiError = (code) => {
  const map = {
    missing_fields: 'Please fill in all required fields.',
    missing_email: 'Please enter an email address.',
    email_in_use: 'That email is already in use. Try signing in instead.',
    invalid_invite: 'This invite link is invalid, expired, or has already been used.',
    invalid_credentials: 'Invalid email or password.',
    missing_token: 'Your session is missing. Please sign in again.',
    invalid_token: 'Your login link or session is no longer valid. Please sign in again.',
    token_expired: 'Your session expired. Please sign in again.',
    invalid_user: 'Your account could not be found. Please sign in again.',
    not_found: 'That item no longer exists.',
    forbidden: "You don't have permission to do that.",
    missing_data: 'Nothing to save yet. Refresh and try again.',
    internal_error: 'The server hit an unexpected error. Please retry in a moment.',
    service_unavailable: 'The backend is temporarily unavailable. Please retry in a moment.',
    slug_taken: 'That workspace name is already taken. Please choose another.',
    slug_invalid: 'Workspace name can only contain lowercase letters, numbers, and hyphens.',
    billing_required: 'An active subscription is required to access this workspace.',
  };
  return map[String(code || '').toLowerCase()] || '';
};

const formatRetryAfter = (retryAfterHeader) => {
  if (!retryAfterHeader) return '';
  const asSeconds = Number(retryAfterHeader);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return ` Try again in about ${Math.max(1, Math.round(asSeconds))}s.`;
  }
  const at = new Date(retryAfterHeader);
  if (Number.isFinite(at.getTime())) {
    const seconds = Math.round((at.getTime() - Date.now()) / 1000);
    if (seconds > 0) return ` Try again in about ${seconds}s.`;
  }
  return '';
};

/**
 * Custom error class for billing-required (HTTP 402) responses.
 */
export class BillingRequiredError extends Error {
  constructor(message, responseBody) {
    super(message || 'An active subscription is required.');
    this.name = 'BillingRequiredError';
    this.responseBody = responseBody;
  }
}

/**
 * Main API fetch utility.
 * @param {string} path - API path (e.g. '/api/me')
 * @param {object} opts - { token, method, body, timeoutMs, orgSlug }
 * @param {object} [clientSettings] - optional client settings object
 */
export const apiFetch = async (path, { token, method = 'GET', body, timeoutMs = 10000, orgSlug } = {}, clientSettings) => {
  const apiBase = getApiBase(clientSettings).replace(/\/$/, '');
  let res;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(orgSlug ? { 'X-Org-Slug': orgSlug } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s. Check server health and try again.`);
    const root = e?.message ? `Network error: ${e.message}` : 'Network error';
    throw new Error(`${root}. Could not reach ${apiBase}. Check VITE_API_BASE/server URL and CORS settings.`);
  } finally {
    clearTimeout(t);
  }

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const requestId = res.headers.get('x-request-id') || res.headers.get('x-correlation-id');
  const withRequestId = (text) => requestId ? `${text} (request id: ${requestId})` : text;

  if (!res.ok) {
    if (res.status === 401 && token) {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    }

    let msg = '';
    let body_json = null;
    try {
      if (isJson) {
        body_json = await res.json();
        msg = friendlyApiError(body_json?.error) || body_json?.message || body_json?.error || JSON.stringify(body_json);
      } else {
        msg = await res.text();
      }
    } catch { /* ignore */ }

    // Handle billing required (402)
    if (res.status === 402) {
      throw new BillingRequiredError(
        friendlyApiError(body_json?.error || 'billing_required') || msg || 'An active subscription is required.',
        body_json
      );
    }

    const prefix = `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ''})`;

    if (res.status === 401) throw new Error(withRequestId(msg || 'Session expired. Please log in again.'));
    if (res.status === 403) throw new Error(withRequestId(msg || "You don't have permission to do that."));
    if (res.status === 429) {
      const retryHint = formatRetryAfter(res.headers.get('retry-after'));
      const detail = msg || 'Too many requests. Please wait a moment and try again.';
      throw new Error(withRequestId(`${detail}${retryHint}`));
    }
    if (res.status === 502) throw new Error(withRequestId(msg || 'Upstream backend error (502). Please retry in a moment.'));
    if (res.status === 503) {
      const retryHint = formatRetryAfter(res.headers.get('retry-after'));
      const detail = msg || 'Backend is temporarily unavailable (503). Please retry in a moment.';
      throw new Error(withRequestId(`${detail}${retryHint}`));
    }
    if (res.status === 504) throw new Error(withRequestId(msg || 'Backend timed out (504). Please retry in a moment.'));
    if (res.status >= 500) throw new Error(withRequestId(msg || 'Server error. Please try again in a moment.'));
    if (res.status === 404) throw new Error(withRequestId(msg || 'That item no longer exists or the endpoint was not found.'));
    if (res.status === 413) throw new Error(withRequestId(msg || 'Request payload is too large. Try again with a smaller request.'));

    throw new Error(withRequestId(msg ? `${prefix}: ${msg}` : prefix));
  }

  if (!isJson) return null;

  try {
    return await res.json();
  } catch {
    throw new Error(withRequestId('Backend returned malformed JSON. Check server logs and retry.'));
  }
};
