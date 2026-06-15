/**
 * Platform Home navigation — tab-aware routing for signals and apps.
 */

const MODULE_LIST_PATHS = new Set([
  '/deals',
  '/tasks',
  '/people',
  '/organizations',
  '/quotes',
  '/cases',
  '/helpdesk/cases',
  '/audit/audits',
  '/approvals',
  '/inbox',
  '/events'
]);

const APP_HOME_ROUTES = {
  SALES: '/dashboard/sales',
  HELPDESK: '/helpdesk/cases',
  AUDIT: '/audit/dashboard',
  PORTAL: '/portal/dashboard',
  PROJECTS: '/projects/projects'
};

/**
 * @param {{ route?: string | null, appKey?: string | null, pulseRoute?: string | null }} target
 */
export function resolvePlatformHomeRoute(target) {
  if (target?.route) return target.route;
  const appKey = String(target?.appKey || '').toUpperCase();
  if (appKey && APP_HOME_ROUTES[appKey]) return APP_HOME_ROUTES[appKey];
  if (target?.pulseRoute) return target.pulseRoute;
  return null;
}

function isModuleListPath(path) {
  const base = String(path || '').split('?')[0];
  if (MODULE_LIST_PATHS.has(base)) return true;
  return MODULE_LIST_PATHS.has(base.replace(/\/+$/, ''));
}

/**
 * @param {import('vue-router').Router} router
 * @param {(path: string, opts?: Record<string, unknown>) => void} openTab
 * @param {string} route
 * @param {{ title?: string }} [options]
 */
export function navigatePlatformHomeRoute(router, openTab, route, options = {}) {
  if (!route) return;
  const basePath = route.split('?')[0];
  if (openTab && isModuleListPath(basePath)) {
    openTab(route, {
      title: options.title,
      background: false,
      insertAdjacent: true
    });
    return;
  }
  router.push(route);
}
