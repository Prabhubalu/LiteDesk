/** Pathname-only checks — safe before vue-router finishes initial navigation. */
export function resolveRoutePathname(path) {
  return String(path || '').split('?')[0];
}

export function isStandalonePublicRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p.startsWith('/book/')
    || p.startsWith('/appointments/manage/')
    || p.startsWith('/webforms/public/')
    || p.startsWith('/webforms/embed/')
    || p.startsWith('/webforms/staff-preview/')
    || p.startsWith('/forms/public/')
    || p.startsWith('/public/quotes/')
  );
}

export function isAuthLifecyclePublicRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p === '/accept-invite'
    || p === '/verify-email'
    || p === '/forgot-password'
    || p === '/reset-password'
    || p === '/login'
  );
}

export function isStandaloneShelllessPath(path) {
  return isStandalonePublicRoute(path);
}

/** Routes the tab bar must not track (public, auth, audit shell, landing). */
export function shouldSkipTabRoute(path) {
  const p = resolveRoutePathname(path);
  return (
    p === '/'
    || p.startsWith('/audit/')
    || isStandalonePublicRoute(path)
    || isAuthLifecyclePublicRoute(path)
  );
}
