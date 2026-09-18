import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";
import { canAccess, homeRouteFor, isPublicRoute } from "@/lib/auth/access";

/**
 * Refreshes the Supabase session cookie and performs an optimistic access
 * check. This runs on every request, including prefetches, so it only reads the
 * session — it never queries the database.
 *
 * Roles here come from the JWT, and the two claim sources are not equally
 * trustworthy:
 *
 *   app_metadata.role   only the access-token hook or the service role can set
 *                       it, so it can be trusted for privilege decisions.
 *   user_metadata.role  the user can change it themselves with
 *                       `auth.updateUser`, so it is a hint, not a credential.
 *
 * When the trusted claim is missing (the hook in
 * `supabase/migrations/0001_security_and_settings.sql` is optional) this only
 * checks that the caller is signed in and leaves role enforcement to the
 * database-backed check in `AppContext` and to row level security. Guessing
 * from the untrusted claim would lock an admin out of their own dashboard,
 * because promoting someone writes `profiles.role`, not their JWT.
 */
export async function proxy(request) {
  const { supabase, response } = createClient(request);

  // getUser() revalidates the token with Supabase and refreshes the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const params = request.nextUrl.searchParams;

  // Supabase validates `redirect_to` against the dashboard's Redirect URLs
  // allow-list and, when it does not match, silently falls back to the
  // project's Site URL. That drops a confirmation code on "/" (or wherever
  // Site URL points) where nothing handles it, and the link looks broken.
  //
  // Rather than depending on that config being right, forward any auth code
  // that lands on the wrong path to the callback, which is the only place that
  // knows how to exchange it.
  const hasAuthCode =
    params.has('code') ||
    (params.has('token_hash') && params.has('type')) ||
    params.has('error_description');

  if (hasAuthCode && pathname !== '/auth/callback') {
    const forwarded = new URL('/auth/callback', request.url);
    params.forEach((value, key) => forwarded.searchParams.set(key, value));
    // Preserve where they were headed, unless the link already said. Landing
    // pages are not destinations - sending someone back to /login right after
    // confirming would be a loop in all but name.
    if (!forwarded.searchParams.has('next') && !isPublicRoute(pathname)) {
      forwarded.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(forwarded);
  }

  if (!user) {
    if (isPublicRoute(pathname)) return response;
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  const trustedRole = user.app_metadata?.role;
  const hintedRole = user.user_metadata?.role;

  // Signed-in users have no reason to sit on the login or signup screens.
  if (pathname === "/login" || pathname === "/signup" || pathname === "/register") {
    return NextResponse.redirect(
      new URL(homeRouteFor(trustedRole || hintedRole), request.url)
    );
  }

  if (trustedRole && !canAccess(pathname, trustedRole)) {
    return NextResponse.redirect(new URL(homeRouteFor(trustedRole), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (route handlers do their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (.svg, .png, .jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
