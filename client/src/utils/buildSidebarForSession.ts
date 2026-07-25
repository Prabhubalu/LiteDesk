import type { AppRegistry, SidebarStructure } from '@/types/sidebar.types';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { buildSidebarFromRegistry } from '@/utils/buildSidebarFromRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import { fetchAddonNavigation } from '@/utils/addonNavigation';
import {
  hasCommercialPlatformEntitlement,
  isCommercialPlatformModuleKey
} from '@/utils/commercialPlatformParticipation';
import { validateUserTypeForApp } from '@/utils/appUserTypeAccess';
import { buildAppAccessProfile } from '@/router/appAccessGuards';

type PermissionSnapshotUserLike = Parameters<typeof createPermissionSnapshot>[0];
type UserLike = PermissionSnapshotUserLike & {
  userType?: string;
  organizationId?: string;
  organization?: { _id?: string };
  allowedApps?: string[];
  appAccess?: Array<{
    appKey?: string;
    status?: string;
  }>;
};

type OrganizationLike = { _id?: string } | null | undefined;

function resolveOrganizationId(user: UserLike, organization?: OrganizationLike): string {
  return String(
    user?.organizationId
    || user?.organization?._id
    || organization?._id
    || '',
  ).trim();
}

export type BuildSidebarForSessionResult = {
  structure: SidebarStructure;
  entitlementScopedRegistry: AppRegistry;
};

type NormalizedUserAppAccess = {
  allowedAppKeys: Set<string>;
  hasExplicitUserAppAccessData: boolean;
};

function normalizeUserAppAccess(user: UserLike): NormalizedUserAppAccess {
  const allowedAppKeys = new Set<string>();
  const normalizedAllowedApps = Array.isArray(user?.allowedApps) ? user.allowedApps : [];

  for (const app of normalizedAllowedApps) {
    if (typeof app !== 'string') continue;
    const appKey = app.trim().toUpperCase();
    if (appKey) allowedAppKeys.add(appKey);
  }

  const normalizedAppAccess = Array.isArray(user?.appAccess) ? user.appAccess : [];
  for (const access of normalizedAppAccess) {
    if (!access || typeof access !== 'object') continue;
    const appKey = typeof access.appKey === 'string' ? access.appKey.trim().toUpperCase() : '';
    if (!appKey) continue;
    const status = String(access.status || 'ACTIVE').toUpperCase();
    if (status === 'ACTIVE') {
      allowedAppKeys.add(appKey);
    }
  }

  return {
    allowedAppKeys,
    hasExplicitUserAppAccessData: normalizedAllowedApps.length > 0 || normalizedAppAccess.length > 0,
  };
}

function syncApplicationsFromCoreModules(structure: SidebarStructure): void {
  const coreApp = structure.applications?.find((app) => app.id === 'CORE');
  if (coreApp) {
    coreApp.items = structure.coreModules;
  }
  if (structure.coreModules.length === 0) {
    structure.applications = (structure.applications || []).filter((app) => app.id !== 'CORE');
  } else if (!coreApp && structure.applications) {
    structure.applications = [
      {
        id: 'CORE',
        name: 'Core',
        nameKey: 'navigation.appCore',
        icon: 'squares',
        order: 0,
        items: structure.coreModules,
      },
      ...structure.applications,
    ].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  if (structure.appNav?.appId === 'CORE') {
    structure.appNav = { appId: 'CORE', modules: structure.coreModules };
  }
}

function applyCoreModuleEntitlementFilters(
  structure: SidebarStructure,
  allowedAppKeys: Set<string>,
  hasExplicitUserAppAccessData: boolean,
  hasAppAccess: (appKey: string) => boolean
): void {
  const hasCommercial = hasCommercialPlatformEntitlement(
    allowedAppKeys,
    hasExplicitUserAppAccessData,
    hasAppAccess
  );

  structure.coreModules = structure.coreModules.filter((item) => {
    if (item.kind !== 'coreModule') return false;
    const moduleKey = item.moduleKey.toLowerCase();
    if (!moduleKey) return false;
    if (isCommercialPlatformModuleKey(moduleKey)) {
      return hasCommercial;
    }
    return true;
  });
  syncApplicationsFromCoreModules(structure);
}

function applyPortalOnlySidebarFilters(
  structure: SidebarStructure,
  userType: string,
  allowedAppKeys: Set<string>,
): void {
  if (String(userType).toUpperCase() !== 'EXTERNAL') return;
  const profile = buildAppAccessProfile((appKey) => allowedAppKeys.has(String(appKey).toUpperCase()));
  if (!profile.hasOnlyPortalAccess) return;

  structure.coreModules = [];
  syncApplicationsFromCoreModules(structure);
  // Platform shell surfaces are not part of the customer portal experience.
  const portalHiddenShellIds = new Set(['home', 'inbox', 'astra', 'approvals', 'attention']);
  structure.shell = structure.shell.filter((item) => !portalHiddenShellIds.has(item.id));
}

/**
 * Builds the locked SidebarStructure for the current session:
 * - Filters app registry by app entitlement (hasAppAccess)
 * - Keeps PLATFORM entry for internal module resolution
 * - Hides platform commercial modules unless Sales and/or Inventory is entitled
 */
export async function buildSidebarStructureForSession(
  user: UserLike,
  hasAppAccess: (appKey: string) => boolean,
  organization?: OrganizationLike,
): Promise<BuildSidebarForSessionResult> {
  const registry = await getAppRegistry();
  const { allowedAppKeys, hasExplicitUserAppAccessData } = normalizeUserAppAccess(user);
  const userType = user?.userType || 'INTERNAL';

  const entitlementScopedRegistry = Object.fromEntries(
    Object.entries(registry).filter(([appKey]) => {
      const normalizedAppKey = String(appKey).toUpperCase();
      if (normalizedAppKey === 'PLATFORM') return true;
      if (!validateUserTypeForApp(userType, normalizedAppKey)) return false;
      if (hasExplicitUserAppAccessData) {
        return allowedAppKeys.has(normalizedAppKey);
      }
      return hasAppAccess(appKey);
    })
  ) as AppRegistry;

  const snapshot = createPermissionSnapshot(user);
  const orgId = resolveOrganizationId(user, organization);
  const addonNav = orgId ? await fetchAddonNavigation(orgId) : [];
  const structure = await buildSidebarFromRegistry(entitlementScopedRegistry, snapshot, import.meta.env.DEV, addonNav);

  applyCoreModuleEntitlementFilters(
    structure,
    allowedAppKeys,
    hasExplicitUserAppAccessData,
    hasAppAccess
  );

  applyPortalOnlySidebarFilters(structure, userType, allowedAppKeys);

  // Hide Astra shell nav when Arivu AI addon is disabled / not entitled.
  const { isAiSuiteEntitled } = await import('@/utils/aiSuiteEntitlement');
  if (!isAiSuiteEntitled(user)) {
    structure.shell = (structure.shell || []).filter(
      (item) => item?.id !== 'astra',
    );
  }

  return { structure, entitlementScopedRegistry };
}
