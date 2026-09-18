/**
 * Resolves the public origin of this deployment.
 *
 * Supabase builds confirmation links as
 * `<supabase>/auth/v1/verify?...&redirect_to=<this>`, and when the app passes
 * nothing it falls back to the project's Site URL — which is normally
 * `http://localhost:3000`, so emails sent from production pointed people at
 * their own machine.
 *
 * Order matters: an explicit `NEXT_PUBLIC_SITE_URL` wins everywhere, so a
 * preview build cannot email production links or vice versa.
 */
export function getSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  if (typeof window !== 'undefined') return window.location.origin;

  // Vercel exposes the deployment host to both bundles.
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

/** The address Supabase should send people back to after they confirm. */
export function getAuthCallbackUrl(next = '/') {
  const url = new URL('/auth/callback', getSiteUrl());
  if (next && next !== '/') url.searchParams.set('next', next);
  return url.toString();
}
