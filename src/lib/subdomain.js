/**
 * Subdomain detection utility for ShiftWay.
 *
 * Root domain:      shiftway.app, www.shiftway.app, localhost, 127.0.0.1
 * Workspace subdomain: {slug}.shiftway.app, {slug}.localhost (dev)
 *
 * Dev override: ?org={slug} query param (useful when using localhost directly)
 */

const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || 'shiftway.app';

/**
 * @returns {{ isRootDomain: boolean, workspaceSlug: string|null }}
 */
export function getSubdomainInfo() {
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const orgParam = params.get('org');

  // Localhost / 127.0.0.1 with no subdomain → root domain
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (orgParam) {
      return { isRootDomain: false, workspaceSlug: orgParam };
    }
    return { isRootDomain: true, workspaceSlug: null };
  }

  // Check if hostname matches APP_DOMAIN exactly (root) or www.APP_DOMAIN
  if (hostname === APP_DOMAIN || hostname === `www.${APP_DOMAIN}`) {
    return { isRootDomain: true, workspaceSlug: null };
  }

  // Check if hostname ends with .APP_DOMAIN → workspace subdomain
  const suffix = `.${APP_DOMAIN}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    // Exclude www
    if (slug && slug !== 'www') {
      return { isRootDomain: false, workspaceSlug: slug };
    }
  }

  // Check for {slug}.localhost pattern
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.slice(0, -'.localhost'.length);
    if (slug) {
      return { isRootDomain: false, workspaceSlug: slug };
    }
  }

  // Fallback: treat as root domain
  if (orgParam) {
    return { isRootDomain: false, workspaceSlug: orgParam };
  }

  return { isRootDomain: true, workspaceSlug: null };
}

/**
 * Build a workspace URL for the given slug.
 * In dev (localhost), uses /?org={slug}.
 * In prod, uses https://{slug}.{APP_DOMAIN}.
 */
export function buildWorkspaceUrl(slug) {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${window.location.origin}/?org=${encodeURIComponent(slug)}`;
  }
  return `https://${slug}.${APP_DOMAIN}`;
}
