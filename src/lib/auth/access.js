/**
 * Single source of truth for which roles may open which routes.
 *
 * Used by `src/proxy.js` for the edge-side redirect (an optimistic check based
 * on the session cookie) and by the UI to decide what to render. The proxy is
 * the first line of defence only — row level security in Postgres is what
 * actually protects the data.
 */

export const ROLES = ['admin', 'trainer', 'trainee'];

/** Roles a user may assign to themselves via the workspace switcher. */
export const SELF_ASSIGNABLE_ROLES = ['trainer', 'trainee'];

/** Routes reachable without a session. */
export const PUBLIC_ROUTES = ['/', '/login', '/signup', '/register', '/auth/callback'];

/**
 * Prefix -> roles allowed. Longest matching prefix wins, so `/trainer/quiz`
 * is matched before `/trainer`. Anything not listed needs a session but no
 * particular role.
 */
const ROUTE_ROLES = [
  ['/admin', ['admin']],
  ['/admindashboard', ['admin']],
  ['/trainer', ['trainer', 'admin']],
  ['/trainerattendance', ['trainer', 'admin']],
  ['/trainerquiz', ['trainer', 'admin']],
  ['/trainertrainings', ['trainer', 'admin']],
  ['/trainee', ['trainee', 'trainer', 'admin']],
  ['/traineedashboard', ['trainee', 'trainer', 'admin']],
  ['/traineemobileapp', ['trainee', 'trainer', 'admin']],
  ['/traineequiz', ['trainee', 'trainer', 'admin']],
  ['/scan', ['trainee', 'trainer', 'admin']],
  ['/qrscanner', ['trainee', 'trainer', 'admin']],
  ['/quiz', ['trainee', 'trainer', 'admin']],
  ['/quizresults', ['trainee', 'trainer', 'admin']],
  ['/training', ['trainee', 'trainer', 'admin']],
  ['/trainingdetails', ['trainee', 'trainer', 'admin']],
];

export function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * Roles allowed on `pathname`, or `null` when any signed-in role may enter.
 *
 * Matching is on whole segments, so `/trainerfoo` does not inherit the
 * `/trainer` rule. An unmapped path still requires a session; it just has no
 * role restriction. New pages under `/admin/*` or `/trainer/*` are covered
 * automatically because those prefixes match the whole subtree.
 */
export function allowedRolesFor(pathname) {
  let match = null;
  for (const [prefix, roles] of ROUTE_ROLES) {
    const hit = pathname === prefix || pathname.startsWith(prefix + '/');
    if (hit && (!match || prefix.length > match[0].length)) {
      match = [prefix, roles];
    }
  }
  return match ? match[1] : null;
}

export function canAccess(pathname, role) {
  if (isPublicRoute(pathname)) return true;
  const allowed = allowedRolesFor(pathname);
  if (!allowed) return !!role;
  return !!role && allowed.includes(role);
}

/** Where a freshly signed-in user of `role` should land. */
export function homeRouteFor(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'trainer') return '/trainer/trainings';
  return '/trainee/dashboard';
}
