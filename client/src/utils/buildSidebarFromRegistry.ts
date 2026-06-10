/**
 * ============================================================================
 * PLATFORM SIDEBAR: Builder Function (LOCKED CONTRACT)
 * ============================================================================
 *
 * SOURCE OF TRUTH:
 * This builder produces the locked `SidebarStructure` contract only.
 *
 * Critical invariant:
 * “The sidebar shows surfaces, identities, lenses, and governance — never raw
 * entities, app-agnostic primitives, or infrastructure.”
 *
 * Enforcement:
 * - Shell: Home / Inbox (mail) / Approvals / **Attention** (`/platform/attention`) / Search
 * - Core Modules: registry PLATFORM modules (settings fallback) only
 * - App lens: exactly ONE active app at a time (route → lastActiveAppId fallback)
 * - App nav: dashboard + modules for active app only
 * - Platform: governance only
 *
 * ============================================================================
 */

import type { SidebarStructure, SidebarItem, AppSummary, AppRegistry, AppRegistryModule } from '@/types/sidebar.types';
import type { PermissionSnapshot } from '@/types/permission-snapshot.types';
import { hasPermission as checkPermission } from '@/types/permission-snapshot.types';
import { memoizeBuilder } from '@/utils/builderCache';
import { validateAppRegistryOrThrow } from '@/utils/validateAppRegistry';
import { assertValidSidebarStructure } from '@/utils/assertValidSidebarStructure';
import { getActivePinia } from 'pinia';
import { fetchCoreModulesSettingsCached } from '@/utils/tenantSchemaApiCache';
import {
  getAppNameKey,
  getModuleLabelKey,
  getSurfaceLabelKey,
} from '@/utils/navigationLabels';

const LAST_ACTIVE_APP_ID_KEY = 'arivu-sidebar-last-active-app-id';

/**
 * Hard stops (doctrine):
 * These are raw entities or infrastructure-like primitives that must not be
 * represented as sidebar navigation items in the locked contract.
 */
const FORBIDDEN_RAW_ENTITY_MODULE_KEYS = new Set([
  'people',
  'tasks',
  'events',
  'forms',
  'items',
  'organizations',
  'quotes',
]);

function hasPermission(permission: string | undefined, snapshot: PermissionSnapshot): boolean {
  return checkPermission(snapshot, permission);
}

function getCurrentPathname(): string {
  try {
    if (typeof window === 'undefined') return '';
    return window.location?.pathname || '';
  } catch {
    return '';
  }
}

function getLastActiveAppIdFromStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_ACTIVE_APP_ID_KEY);
  } catch {
    return null;
  }
}

function collectAllModules(appRegistry: AppRegistry): AppRegistryModule[] {
  const all: AppRegistryModule[] = [];
  for (const app of Object.values(appRegistry)) {
    for (const m of app.modules || []) all.push(m);
  }
  return all;
}

function listApps(appRegistry: AppRegistry): Array<{ appKey: string; label: string; dashboardRoute: string; icon?: string; order?: number; modules?: AppRegistryModule[] }> {
  return Object.values(appRegistry).filter((a) => a.appKey !== 'PLATFORM' && a.appKey.toLowerCase() !== 'platform');
}

function resolveActiveAppId(
  appRegistry: AppRegistry,
  currentPath: string,
  fallbackLastActiveAppId: string | null
): string {
  const apps = listApps(appRegistry);
  const normalizedPath = String(currentPath || '');

  // 0) Explicit app-scoped dashboard route (e.g. /dashboard/helpdesk)
  // This must take precedence over registry dashboardRoute matching because
  // legacy/stale metadata may still carry old defaultRoute values.
  if (normalizedPath.startsWith('/dashboard/')) {
    const routeAppKey = String(normalizedPath.split('/')[2] || '').toUpperCase();
    if (routeAppKey) {
      const matched = apps.find((a) => String(a.appKey || '').toUpperCase() === routeAppKey);
      if (matched) return matched.appKey;
    }
  }

  // 0b) Dedicated app shells (portal customer UI, audit workspace, helpdesk desk)
  const pathPrefixToAppKey: Array<[string, string]> = [
    ['/portal/', 'PORTAL'],
    ['/audit/', 'AUDIT'],
    ['/helpdesk/', 'HELPDESK'],
    ['/inventory/', 'INVENTORY'],
  ];
  for (const [prefix, appKey] of pathPrefixToAppKey) {
    if (!normalizedPath.startsWith(prefix)) continue;
    const matched = apps.find((a) => String(a.appKey || '').toUpperCase() === appKey);
    if (matched) return matched.appKey;
  }

  // 1) Resolve from current route (dashboard or module match)
  for (const app of apps) {
    if (normalizedPath === app.dashboardRoute || normalizedPath.startsWith(app.dashboardRoute + '/')) {
      return app.appKey;
    }
    for (const module of app.modules || []) {
      if (!module.route) continue;
      if (normalizedPath === module.route || normalizedPath.startsWith(module.route + '/')) {
        return app.appKey;
      }
    }
  }

  // 2) Fallback to last active app lens
  if (fallbackLastActiveAppId) {
    const normalized = fallbackLastActiveAppId.toUpperCase();
    if (apps.some((a) => a.appKey.toUpperCase() === normalized)) return fallbackLastActiveAppId;
  }

  // 3) Final fallback: first app by order
  const sorted = [...apps].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return sorted[0]?.appKey || '';
}

function sidebarLabel(labelKey: string | undefined, fallback: string): { label: string; labelKey?: string } {
  return labelKey ? { label: fallback, labelKey } : { label: fallback };
}

function buildShell(snapshot: PermissionSnapshot): SidebarItem[] {
  // These are stable surfaces (not registry-driven modules).
  const shell: SidebarItem[] = [];

  shell.push({
    kind: 'surface',
    id: 'home',
    ...sidebarLabel(getSurfaceLabelKey('home'), 'Home'),
    route: '/platform/home',
    icon: 'home',
  });

  shell.push({
    kind: 'surface',
    id: 'inbox',
    ...sidebarLabel(getSurfaceLabelKey('inbox'), 'Inbox'),
    route: '/inbox',
    icon: 'inbox',
  });

  shell.push({
    kind: 'surface',
    id: 'approvals',
    ...sidebarLabel(getSurfaceLabelKey('approvals'), 'Approvals'),
    route: '/approvals',
    icon: 'check-circle',
  });

  shell.push({
    kind: 'surface',
    id: 'attention',
    ...sidebarLabel(getSurfaceLabelKey('attention'), 'Attention'),
    route: '/platform/attention',
    icon: 'exclamation-triangle',
  });

  // Search exists as a shell surface, but is executed via UI (modal) rather than navigation.
  shell.push({
    kind: 'surface',
    id: 'search',
    ...sidebarLabel(getSurfaceLabelKey('search'), 'Search'),
    route: '/search', // Intentionally not a real route; the renderer handles this surface explicitly.
    icon: 'magnifying-glass',
  });

  return shell;
}

/**
 * Build Core Modules section from app registry PLATFORM modules.
 * Filters by permissions (hides if user has zero access).
 * Respects module order as defined in registry metadata.
 */
function buildCoreModulesFromRegistry(appRegistry: AppRegistry, snapshot: PermissionSnapshot): SidebarItem[] {
  const platformModules = appRegistry.PLATFORM?.modules || [];
  const modules = platformModules
    .filter((module) => {
      const moduleKey = module.moduleKey?.toLowerCase();
      if (!moduleKey) return false;
      if (module.navigationEntity !== true && module.navigationCore !== true && module.appKey?.toLowerCase() !== 'platform') {
        return false;
      }
      return hasPermission(module.permission || `${moduleKey}.view`, snapshot);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((module) => {
      const moduleKey = module.moduleKey?.toLowerCase() || '';

      const fallbackLabel = module.label || moduleKey;
      const labelKey = getModuleLabelKey(moduleKey);
      return {
        kind: 'coreModule',
        id: moduleKey,
        ...sidebarLabel(labelKey, fallbackLabel),
        route: module.route || `/${moduleKey}`,
        icon: module.icon && module.icon !== 'module' ? module.icon : moduleKey,
        moduleKey,
        order: module.order,
      } satisfies SidebarItem;
    });

  return dedupeCoreModules(modules);
}

/**
 * Fallback for older registry payloads that do not include PLATFORM modules.
 */
async function fetchCoreModulesFromSettings(snapshot: PermissionSnapshot): Promise<SidebarItem[]> {
  try {
    // Check if we're in a browser environment and can make API calls
    // This prevents errors during dev self-tests or SSR
    if (typeof window === 'undefined') {
      return [];
    }

    // Check if Pinia is initialized before making API calls
    // apiClient uses Pinia stores, so we need Pinia to be active
    const pinia = getActivePinia();
    if (!pinia) {
      // Pinia not initialized - this is expected during dev self-tests or before app initialization
      // Silently return empty array (no warning needed as this is expected behavior)
      return [];
    }

    const response = await fetchCoreModulesSettingsCached();

    const modules = response?.modules || [];

    // Filter enabled modules and check permissions
    const coreModules: SidebarItem[] = modules
      .filter((module: any) => {
        // Only include platform-owned modules
        if (!module.platformOwned) return false;

        // Check if user has any permission for this module
        // Permission format: {moduleKey}.view (e.g., 'people.view', 'organizations.view')
        const moduleKey = module.moduleKey?.toLowerCase();
        if (!moduleKey) return false;

        // Map module keys to permission keys
        const permissionKey = `${moduleKey}.view`;
        return hasPermission(permissionKey, snapshot);
      })
      .sort((a: any, b: any) => {
        // Respect order from configuration (if available)
        // Otherwise sort by moduleKey for consistency
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        return (a.moduleKey || '').localeCompare(b.moduleKey || '');
      })
      .map((module: any) => {
        const moduleKey = module.moduleKey?.toLowerCase() || '';
        
        // Construct route from moduleKey (e.g., 'people' -> '/people')
        const route = `/${moduleKey}`;
        
        // Determine icon - use module icon if available, otherwise use moduleKey
        // The API returns icon as 'module', so we'll use moduleKey for icon lookup
        const icon = module.icon && module.icon !== 'module' ? module.icon : moduleKey;

        const fallbackLabel = module.name || module.label || moduleKey;
        const labelKey = getModuleLabelKey(moduleKey);
        return {
          kind: 'coreModule',
          id: moduleKey,
          ...sidebarLabel(labelKey, fallbackLabel),
          route,
          icon,
          moduleKey,
          order: module.order,
        } satisfies SidebarItem;
      });
    
    return dedupeCoreModules(coreModules);
  } catch (error) {
    console.error('[buildSidebarFromRegistry] Failed to fetch core modules:', error);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

const IMPORTS_MODULE_KEY = 'imports';

function pinImportsLast(coreModules: SidebarItem[]): SidebarItem[] {
  const importsIndex = coreModules.findIndex(
    (item) => item.kind === 'coreModule' && item.moduleKey === IMPORTS_MODULE_KEY
  );
  if (importsIndex === -1 || importsIndex === coreModules.length - 1) {
    return coreModules;
  }
  const importsItem = coreModules[importsIndex];
  if (!importsItem) {
    return coreModules;
  }
  return [
    ...coreModules.slice(0, importsIndex),
    ...coreModules.slice(importsIndex + 1),
    importsItem,
  ];
}

function dedupeCoreModules(coreModules: SidebarItem[]): SidebarItem[] {
  const uniqueCoreModules = new Map<string, SidebarItem>();
  for (const item of coreModules) {
    const moduleKey =
      item.kind === 'coreModule' ? item.moduleKey : item.kind === 'app' && item.moduleKey ? item.moduleKey : undefined;
    const key = String((moduleKey || item.id) || '').toLowerCase();
    if (!key || uniqueCoreModules.has(key)) continue;
    uniqueCoreModules.set(key, item);
  }

  return pinImportsLast(Array.from(uniqueCoreModules.values()));
}

function buildAppSwitcherApps(appRegistry: AppRegistry, snapshot: PermissionSnapshot): AppSummary[] {
  return listApps(appRegistry)
    .map((app) => {
      const modules = (app.modules || []).filter((m) => {
        if (m.navigationCore === true) return false;
        if (m.navigationEntity === true) return false;
        if (m.excludeFromApps === true) return false;
        if (m.appKey && m.appKey.toLowerCase() === 'platform') return false;
        if (FORBIDDEN_RAW_ENTITY_MODULE_KEYS.has(m.moduleKey)) return false;
        return true;
      });

      // If app has modules, check if user has access to any of them
      // If app has no modules (dashboard-only app), include it anyway
      const hasAnyAccess = modules.length === 0 || modules.some((m) => hasPermission(m.permission, snapshot));
      return { app, hasAnyAccess };
    })
    .filter((x) => x.hasAnyAccess)
    .map(
      ({ app }) =>
        ({
          id: app.appKey,
          name: app.label,
          nameKey: getAppNameKey(app.appKey),
          dashboardRoute: app.dashboardRoute,
          icon: app.icon,
          order: app.order ?? 999,
        }) satisfies AppSummary
    )
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function resolveRegistryApp(appRegistry: AppRegistry, activeAppId: string) {
  const direct = appRegistry[activeAppId];
  if (direct) return direct;
  const normalized = String(activeAppId || '').toUpperCase();
  return Object.values(appRegistry).find(
    (candidate) => String(candidate?.appKey || '').toUpperCase() === normalized
  );
}

/** Build app-scoped module nav for any entitled app (used by command palette across all apps). */
export function buildAppNavForRegistry(
  appRegistry: AppRegistry,
  appId: string,
  snapshot: PermissionSnapshot
): SidebarStructure['appNav'] {
  return buildAppNav(appRegistry, appId, snapshot);
}

function buildAppNav(appRegistry: AppRegistry, activeAppId: string, snapshot: PermissionSnapshot): SidebarStructure['appNav'] {
  const app = resolveRegistryApp(appRegistry, activeAppId);
  if (!app) return { appId: activeAppId, modules: [] };

  // Enforce: ONLY one app lens is ever built.
  const dashboardRoute = String(app.dashboardRoute || '').replace(/\/+$/, '');

  const modules: SidebarItem[] = (app.modules || [])
    .filter((m) => {
      if (m.showInSidebar === false) return false;
      if (m.navigationCore === true) return false;
      if (m.navigationEntity === true) return false;
      if (m.excludeFromApps === true) return false;
      if (m.appKey && m.appKey.toLowerCase() === 'platform') return false;
      if (FORBIDDEN_RAW_ENTITY_MODULE_KEYS.has(m.moduleKey)) return false;
      // Inventory app: Dashboard is the only lens until stock workbench UI ships.
      if (
        String(activeAppId || '').toUpperCase() === 'INVENTORY' &&
        String(m.moduleKey || '').toLowerCase() === 'inventory'
      ) {
        return false;
      }
      const moduleRoute = String(m.route || '').replace(/\/+$/, '');
      if (dashboardRoute && moduleRoute && moduleRoute === dashboardRoute) return false;
      return hasPermission(m.permission, snapshot);
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map(
      (m) =>
        ({
          kind: 'app',
          id: `${activeAppId}:${m.moduleKey}`,
          ...sidebarLabel(getModuleLabelKey(m.moduleKey) || undefined, m.label),
          route: m.route,
          icon:
            String(activeAppId || '').toUpperCase() === 'HELPDESK' &&
            String(m.moduleKey || '').toLowerCase() === 'cases'
              ? 'ticket'
              : m.icon,
          moduleKey: m.moduleKey,
        }) satisfies SidebarItem
    );

  const dashboard: SidebarItem = {
    kind: 'app',
    id: activeAppId,
    // The first app-nav entry is always the app dashboard.
    // Displayed as "Dashboard" to avoid duplicating the app name in the nav list.
    ...sidebarLabel(getModuleLabelKey('dashboard'), 'Dashboard'),
    route: app.dashboardRoute,
    // Use route-context-aware dashboard icons so tab and sidebar stay visually aligned.
    // Audit dashboard gets a distinct analytics icon; others keep the generic grid icon.
    icon: String(activeAppId || '').toUpperCase() === 'AUDIT' ? 'presentation-chart' : 'squares',
  };

  return { appId: activeAppId, dashboard, modules };
}

function buildPlatformGovernance(snapshot: PermissionSnapshot): SidebarItem[] {
  // Sidebar footer is not for navigation or configuration.
  // Settings is accessed via the profile menu.
  // Apps is switched exclusively via the App Switcher (mode selector).
  // Users is accessed via governance surfaces outside the sidebar footer.
  return [];
}

export async function buildSidebarFromRegistry(
  appRegistry: AppRegistry,
  snapshot: PermissionSnapshot,
  validate: boolean = import.meta.env.DEV
): Promise<SidebarStructure> {
  if (validate) {
    try {
      validateAppRegistryOrThrow(appRegistry);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Registry validation failed:', error);
    }
  }

  const currentPath = getCurrentPathname();
  const lastActiveAppId = getLastActiveAppIdFromStorage();

  const activeAppId = resolveActiveAppId(appRegistry, currentPath, lastActiveAppId);

  const registryCoreModules = buildCoreModulesFromRegistry(appRegistry, snapshot);
  const coreModules =
    registryCoreModules.length > 0 ? registryCoreModules : await fetchCoreModulesFromSettings(snapshot);

  // Note: We can't use memoizeBuilder here because buildCoreModules is async
  // and the memoization would need to handle async results differently.
  // For now, we'll build the sidebar structure directly.
  const apps = buildAppSwitcherApps(appRegistry, snapshot);
  const effectiveActiveAppId = activeAppId || apps[0]?.id || '';

  const sidebar: SidebarStructure = {
    shell: buildShell(snapshot),
    coreModules,
    appSwitcher: {
      activeAppId: effectiveActiveAppId,
      apps,
    },
    appNav: buildAppNav(appRegistry, effectiveActiveAppId, snapshot),
    platform: buildPlatformGovernance(snapshot),
  };

  if (import.meta.env.DEV) {
    assertValidSidebarStructure(sidebar);
  }

  return sidebar;
}

// Lightweight dev-only self-test.
// This is intentionally framework-free: fail fast and loudly if doctrine regresses.
if (import.meta.env.DEV) {
  const snapshot: PermissionSnapshot = {
    userId: 'dev-selftest',
    roles: ['admin'],
    permissions: {
      'people.view': true,
      'deals.view': true,
      'tasks.view': true,
      'forms.view': true,
      'events.view': true,
      'items.view': true,
      'settings.view': true,
      'apps.view': true,
      'users.view': true,
    },
    generatedAt: Date.now(),
  };

  const registry: AppRegistry = {
    SALES: {
      appKey: 'SALES',
      label: 'Sales',
      dashboardRoute: '/dashboard/sales',
      modules: [
        { moduleKey: 'deals', label: 'Deals', route: '/deals', permission: 'deals.view', appKey: 'SALES' },
        // Forbidden raw entities (must never appear in SidebarStructure)
        { moduleKey: 'tasks', label: 'Tasks', route: '/tasks', permission: 'tasks.view', appKey: 'SALES' },
        { moduleKey: 'forms', label: 'Forms', route: '/forms', permission: 'forms.view', appKey: 'SALES' },
        { moduleKey: 'events', label: 'Events', route: '/events', permission: 'events.view', appKey: 'SALES' },
        { moduleKey: 'items', label: 'Items', route: '/items', permission: 'items.view', appKey: 'SALES' },
      ],
    },
    PLATFORM: {
      appKey: 'PLATFORM',
      label: 'Platform',
      dashboardRoute: '/platform/home',
      modules: [
        {
          moduleKey: 'people',
          label: 'People',
          route: '/people',
          permission: 'people.view',
          appKey: 'platform',
          navigationEntity: true,
          excludeFromApps: true,
        },
      ],
    },
  };

  const sidebar = await buildSidebarFromRegistry(registry, snapshot, false);

  // Assert: Core Modules structure is valid (may be empty if API not available in dev self-test)
  // Note: In dev self-test, core modules may be empty if Pinia is not initialized
  // This is acceptable as the test is primarily for structure validation
  for (const item of sidebar.coreModules) {
    if (item.kind !== 'coreModule') {
      throw new Error(`[SidebarInvariantViolation] Core Modules must contain only coreModule items (got: ${item.kind})`);
    }
  }

  // Assert: Forbidden raw entities do not appear.
  const forbidden = new Set(['people', 'items', 'forms', 'tasks', 'events', 'organizations']);
  for (const item of sidebar.appNav.modules) {
    if (item.kind === 'app' && typeof item.moduleKey === 'string' && forbidden.has(item.moduleKey)) {
      throw new Error(`[SidebarInvariantViolation] Forbidden module leaked into sidebar: ${item.moduleKey}`);
    }
  }
}
