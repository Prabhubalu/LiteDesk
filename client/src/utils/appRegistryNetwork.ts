/**
 * Network-only app registry fetch (parallel module requests).
 * Cached by appShell store — import this only for uncached fetches / tests.
 */

import type { AppRegistry } from '@/types/sidebar.types';
import apiClient from '@/utils/apiClient';

function resolveModulePermission(appKey: string, moduleKey: string): string | undefined {
  const normalizedAppKey = String(appKey || '').toUpperCase();
  const normalizedModuleKey = String(moduleKey || '').toLowerCase();

  if (normalizedAppKey === 'AUDIT') {
    if (normalizedModuleKey === 'audits' || normalizedModuleKey === 'cases' || normalizedModuleKey === 'responses') {
      return undefined;
    }
  }

  return `${moduleKey}.view`;
}

function mapRawModulesToRegistryModules(app: { appKey: string }, modulesData: any[]): any[] {
  if (!modulesData?.length) return [];

  let modules = modulesData.map((module: any) => {
    const normalizedAppKey = String(app.appKey || '').toUpperCase();
    const normalizedModuleKey = String(module.moduleKey || '').toLowerCase();
    let route = module.routeBase || `/${module.moduleKey}`;
    const normalizedRoute = String(route || '').trim().replace(/\/+$/, '');
    const normalizedIncomingLabel = String(module.label || '').toLowerCase();
    const isHelpdeskCaseSurface =
      normalizedAppKey === 'HELPDESK' &&
      (normalizedModuleKey === 'cases' ||
        normalizedModuleKey === 'ticket' ||
        normalizedModuleKey === 'tickets' ||
        normalizedModuleKey === 'ticklets' ||
        normalizedRoute === '/cases' ||
        normalizedRoute === 'cases' ||
        normalizedRoute === '/helpdesk/cases' ||
        normalizedIncomingLabel.includes('ticket') ||
        normalizedIncomingLabel.includes('ticklet'));

    if (isHelpdeskCaseSurface && (normalizedRoute === '/cases' || normalizedRoute === 'cases')) {
      route = '/helpdesk/cases';
    }
    const normalizedLabel = isHelpdeskCaseSurface ? 'Cases' : module.label;

    if (normalizedAppKey === 'AUDIT' && normalizedModuleKey === 'audits') {
      route = '/audit/audits';
    }
    if (normalizedAppKey === 'AUDIT' && normalizedModuleKey === 'cases') {
      route = '/audit/findings';
    }
    if (normalizedAppKey === 'AUDIT' && normalizedModuleKey === 'responses') {
      route = '/audit/responses';
    }
    if (normalizedAppKey === 'PORTAL') {
      if (normalizedModuleKey === 'portal_support' || normalizedModuleKey === 'support') {
        route = '/portal/cases';
      }
      if (normalizedModuleKey === 'portal_audits') {
        route = '/portal/audits';
      }
      if (normalizedModuleKey === 'portal_actions') {
        route = '/portal/actions';
      }
      if (normalizedModuleKey === 'portal_invoices' || normalizedModuleKey === 'invoices') {
        route = '/portal/invoices';
      }
    }

    return {
      moduleKey: module.moduleKey,
      label: normalizedLabel,
      route,
      permission: resolveModulePermission(app.appKey, module.moduleKey),
      icon: module.icon,
      order: module.sidebarOrder || 0,
      appKey: module.appKey,
      showInSidebar: module.showInSidebar !== false,
      navigationCore: module.navigationCore || false,
      navigationEntity: module.navigationEntity || false,
      excludeFromApps: module.excludeFromApps || false,
      system: module.system || false,
      coreEntity: module.coreEntity || false,
      list: module.list || undefined
    };
  });

  return modules.filter((module) => module.showInSidebar !== false);
}

/** Default Audit app nav when platform module metadata is missing or filtered out. */
function ensureAuditAppNavigationModules(registry: AppRegistry): void {
  const auditKey = Object.keys(registry).find((k) => String(k).toUpperCase() === 'AUDIT');
  if (!auditKey) return;
  const app = registry[auditKey];
  if (!app) return;

  const defaults = [
    { moduleKey: 'audits', label: 'Audits', route: '/audit/audits', icon: 'document-text', order: 1 },
    { moduleKey: 'cases', label: 'Findings', route: '/audit/findings', icon: 'magnifying-glass', order: 2 },
    { moduleKey: 'responses', label: 'Responses', route: '/audit/responses', icon: 'responses', order: 3 },
    { moduleKey: 'schedule', label: 'Schedule', route: '/audit/schedule', icon: 'calendar', order: 4 }
  ];

  app.modules = app.modules || [];
  for (const mod of defaults) {
    const idx = app.modules.findIndex(
      (m) => String(m.moduleKey || '').toLowerCase() === mod.moduleKey
    );
    const navModule = {
      ...mod,
      permission: undefined,
      appKey: auditKey,
      navigationCore: false,
      navigationEntity: false,
      excludeFromApps: false,
      system: false,
      coreEntity: false
    };
    if (idx >= 0) {
      app.modules[idx] = { ...app.modules[idx], ...navModule };
    } else {
      app.modules.push(navModule);
    }
  }
  app.modules.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Portal app sidebar: only customer-native surfaces (not Audit/Helpdesk module clones).
 * - Support cases live here (Helpdesk Phase 1D customer path at /portal/cases).
 * - Audits and corrective actions stay on the portal dashboard + mobile nav (/portal/audits, /portal/actions).
 */
function injectPortalCustomerSupportModule(registry: AppRegistry): void {
  const portalKey = Object.keys(registry).find((k) => String(k).toUpperCase() === 'PORTAL');
  if (!portalKey) return;
  const app = registry[portalKey];
  if (!app) return;

  const hasSupport = (app.modules || []).some((m) => {
    const key = String(m.moduleKey || '').toLowerCase();
    return key === 'portal_support' || key === 'support' || m.route === '/portal/cases';
  });
  if (hasSupport) return;

  app.modules = app.modules || [];
  app.modules.push({
    moduleKey: 'portal_support',
    label: 'Support',
    route: '/portal/cases',
    permission: undefined,
    icon: 'lifebuoy',
    order: 1,
    appKey: portalKey,
    navigationCore: false,
    navigationEntity: false,
    excludeFromApps: false,
    system: false,
    coreEntity: false
  });
}

/** PAY3.1 — Portal invoice pay surface at /portal/invoices */
function injectPortalInvoicesModule(registry: AppRegistry): void {
  const portalKey = Object.keys(registry).find((k) => String(k).toUpperCase() === 'PORTAL');
  if (!portalKey) return;
  const app = registry[portalKey];
  if (!app) return;

  const hasInvoices = (app.modules || []).some((m) => {
    const key = String(m.moduleKey || '').toLowerCase();
    return key === 'portal_invoices' || key === 'invoices' || m.route === '/portal/invoices';
  });
  if (hasInvoices) return;

  app.modules = app.modules || [];
  app.modules.push({
    moduleKey: 'portal_invoices',
    label: 'Invoices',
    route: '/portal/invoices',
    permission: undefined,
    icon: 'banknotes',
    order: 2,
    appKey: portalKey,
    navigationCore: false,
    navigationEntity: false,
    excludeFromApps: false,
    system: false,
    coreEntity: false
  });
  app.modules.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function addPlatformModulesToRegistry(registry: AppRegistry, entityModules: any[] | undefined): void {
  if (!entityModules?.length) return;

  const moduleKeysInApps = new Set<string>();
  for (const app of Object.values(registry)) {
    if (!app || app.appKey === 'PLATFORM') continue;
    for (const module of app.modules || []) {
      if (module.moduleKey) moduleKeysInApps.add(module.moduleKey);
    }
  }

  const platformModulesRaw = entityModules.map((module: any) => ({
    moduleKey: module.moduleKey,
    label: module.label,
    route: module.routeBase || `/${module.moduleKey}`,
    permission: `${module.moduleKey}.view`,
    icon: module.icon,
    order: module.sidebarOrder || 0,
    appKey: module.appKey,
    navigationCore: module.navigationCore || false,
    navigationEntity: module.navigationEntity || false,
    excludeFromApps: module.excludeFromApps || false,
    system: module.system || false,
    coreEntity: module.coreEntity || false,
    list: module.list || undefined
  }));

  const platformModules = platformModulesRaw.filter(
    (module: { moduleKey: string }) => !moduleKeysInApps.has(module.moduleKey)
  );

  registry['PLATFORM'] = {
    appKey: 'PLATFORM',
    label: 'Platform',
    dashboardRoute: '/platform/home',
    modules: platformModules,
    icon: '⚙️',
    order: 0
  };
}

function buildRegistryFromPayload(payload: {
  apps?: any[];
  modulesByAppKey?: Record<string, any[]>;
  entityModules?: any[];
}): AppRegistry {
  const apps = payload.apps || [];
  const registry: AppRegistry = {};
  const specialAppRoutes = ['/audit/', '/portal/', '/helpdesk/', '/projects/'];

  for (const app of apps) {
    const rawModules = payload.modulesByAppKey?.[app.appKey] || [];
    const modules = mapRawModulesToRegistryModules(app, rawModules);

    console.log(`[appRegistryNetwork] App ${app.appKey}:`, {
      name: app.name,
      defaultRoute: app.defaultRoute,
      sidebarOrder: app.sidebarOrder,
      icon: app.icon
    });

    const appKeyLower = app.appKey.toLowerCase();
    let dashboardRoute = app.defaultRoute || `/${appKeyLower}`;

    if (dashboardRoute === '/dashboard') {
      dashboardRoute = `/dashboard/${appKeyLower}`;
    }

    if (appKeyLower !== 'sales' && (dashboardRoute === '/sales/dashboard' || dashboardRoute.startsWith('/sales/'))) {
      dashboardRoute = `/dashboard/${appKeyLower}`;
    }

    const isSpecialAppRoute = specialAppRoutes.some((prefix) => dashboardRoute.startsWith(prefix));

    if (isSpecialAppRoute) {
      // keep
    } else if (dashboardRoute.startsWith(`/${appKeyLower}/`)) {
      dashboardRoute = `/dashboard/${appKeyLower}`;
    } else if (dashboardRoute === `/${appKeyLower}`) {
      dashboardRoute = `/dashboard/${appKeyLower}`;
    } else if (dashboardRoute !== '/dashboard' && !dashboardRoute.startsWith('/dashboard/')) {
      dashboardRoute = `/dashboard/${appKeyLower}`;
    }

    registry[app.appKey] = {
      appKey: app.appKey,
      label: app.name || app.appKey,
      dashboardRoute,
      modules,
      icon: app.icon,
      order: app.sidebarOrder || 0
    };

    const entry = registry[app.appKey];
    if (!entry) continue;
    const isSpecialRoute = specialAppRoutes.some((prefix) => entry.dashboardRoute.startsWith(prefix));
    if (
      !isSpecialRoute &&
      entry.dashboardRoute !== '/dashboard' &&
      !entry.dashboardRoute.startsWith('/dashboard/')
    ) {
      console.warn(
        `[appRegistryNetwork] App ${app.appKey} has unexpected dashboardRoute: ${entry.dashboardRoute}. Expected /dashboard or /dashboard/:appKey`
      );
    }
  }

  addPlatformModulesToRegistry(registry, payload.entityModules);
  ensureAuditAppNavigationModules(registry);
  injectPortalCustomerSupportModule(registry);
  injectPortalInvoicesModule(registry);
  return registry;
}

// UI registry endpoints can change mid-session (apps enabled/disabled, user app
// access edits). Bypass both the apiClient metadata cache and the browser's
// HTTP cache so a stale response (from a deploy that previously sent
// Cache-Control: max-age=86400) cannot mask fresh entitlements.
const NO_CACHE: RequestInit = { cache: 'no-store' };

export async function fetchAppRegistryFromNetwork(): Promise<AppRegistry> {
  try {
    try {
      const registryResponse = await apiClient('/ui/registry', NO_CACHE);
      if (registryResponse.success && registryResponse.data?.apps) {
        return buildRegistryFromPayload(registryResponse.data);
      }
    } catch (error) {
      console.debug('[appRegistryNetwork] Aggregated registry endpoint not available, falling back:', error);
    }

    const appsResponse = await apiClient('/ui/apps', NO_CACHE);

    if (!appsResponse.success || !appsResponse.data) {
      console.warn('[appRegistryNetwork] Failed to fetch apps, returning empty registry');
      return {};
    }

    const apps = appsResponse.data;

    const modulesByAppKey: Record<string, any[]> = {};
    await Promise.all(
      apps.map(async (app: any) => {
        try {
          const modulesResponse = await apiClient(`/ui/apps/${app.appKey}/modules`, NO_CACHE);
          if (modulesResponse.success && modulesResponse.data) {
            modulesByAppKey[app.appKey] = mapRawModulesToRegistryModules(app, modulesResponse.data);
          } else {
            modulesByAppKey[app.appKey] = [];
          }
        } catch (error) {
          console.warn(`[appRegistryNetwork] Failed to fetch modules for app ${app.appKey}:`, error);
          modulesByAppKey[app.appKey] = [];
        }
      })
    );

    const registry = buildRegistryFromPayload({ apps, modulesByAppKey });

    try {
      const entityModulesResponse = await apiClient('/ui/entities', NO_CACHE);
      if (entityModulesResponse.success && entityModulesResponse.data) {
        addPlatformModulesToRegistry(registry, entityModulesResponse.data);
      }
    } catch (error) {
      console.debug('[appRegistryNetwork] Entity modules not available:', error);
    }

    return registry;
  } catch (error) {
    console.error('[appRegistryNetwork] Error fetching app registry:', error);
    return {};
  }
}
