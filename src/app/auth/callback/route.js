import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { homeRouteFor } from '@/lib/auth/access';

/**
 * Lands the user after they click a confirmation or password-reset link.
 *
 * Supabase sends one of two shapes depending on the email template:
 *   ?code=...                  the PKCE flow used by @supabase/ssr
 *   ?token_hash=...&type=...   the older one-time-token flow
 *
 * Both are handled, because a project may still be on the default templates.
 * Whichever arrives is exchanged for a session here — on the server, so the
 * session cookie is set before the browser reaches a protected page.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = url.searchParams.get('next') || '';
  const errorDescription =
    url.searchParams.get('error_description') || url.searchParams.get('error');

  // Behind a proxy the request URL is the internal one, so prefer the
  // forwarded host when building the redirect.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : url.origin;

  const fail = (message) => {
    const to = new URL('/login', origin);
    to.searchParams.set('error', message);
    return NextResponse.redirect(to);
  };

  if (errorDescription) return fail(errorDescription);
  if (!code && !tokenHash) return fail('That confirmation link is missing its token.');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type || 'email' });

  if (error) {
    return fail(
      error.message?.includes('expired')
        ? 'That confirmation link has expired. Sign in to have a new one sent.'
        : `That confirmation link could not be used: ${error.message}`
    );
  }

  // The session cookie is set; send them somewhere useful. Without an explicit
  // `next`, land them in the workspace their role actually opens rather than
  // assuming the trainee portal.
  let fallback = '/trainee/dashboard';
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      fallback = homeRouteFor(profile?.role);
    }
  } catch {
    // A profile read failure should not strand a freshly confirmed account.
  }

  // A `next` that is not a local path is ignored, so a confirmation link
  // cannot be turned into an open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : fallback;
  return NextResponse.redirect(new URL(safeNext, origin));
}
