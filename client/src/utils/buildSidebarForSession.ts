import type { AppRegistry, SidebarStructure } from '@/types/sidebar.types';
import { getAppRegistry } from '@/utils/getAppRegistry';
import { buildSidebarFromRegistry } from '@/utils/buildSidebarFromRegistry';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import {
  hasCommercialPlatformEntitlement,
  isCommercialPlatformModuleKey
} from '@/utils/commercialPlatformParticipation';
import { validateUserTypeForApp } from '@/utils/appUserTypeAccess';

type PermissionSnapshotUserLike = Parameters<typeof createPermissionSnapshot>[0];
type UserLike = PermissionSnapshotUserLike & {
  userType?: string;
  allowedApps?: string[];
  appAccess?: Array<{
    appKey?: string;
    status?: string;
  }>;
};

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
}

/**
 * Builds the locked SidebarStructure for the current session:
 * - Filters app registry by app entitlement (hasAppAccess)
 * - Keeps PLATFORM entry for internal module resolution
 * - Hides platform commercial modules unless Sales and/or Inventory is entitled
 */
export async function buildSidebarStructureForSession(
  user: UserLike,
  hasAppAccess: (appKey: string) => boolean
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
  const structure = await buildSidebarFromRegistry(entitlementScopedRegistry, snapshot);

  applyCoreModuleEntitlementFilters(
    structure,
    allowedAppKeys,
    hasExplicitUserAppAccessData,
    hasAppAccess
  );

  return { structure, entitlementScopedRegistry };
}
