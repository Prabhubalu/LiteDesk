export type AppAccessProfile = {
  hasSalesAccess: boolean;
  hasAuditAccess: boolean;
  hasPortalAccess: boolean;
  hasOnlyAuditAccess: boolean;
  hasOnlyPortalAccess: boolean;
};

const SALES_MODULES = new Set([
  'people',
  'contacts',
  'deals',
  'tasks',
  'events',
  'forms',
  'items',
  'organizations',
]);

export function buildAppAccessProfile(getAccess: (appKey: string) => boolean): AppAccessProfile {
  const hasSalesAccess = getAccess('SALES');
  const hasAuditAccess = getAccess('AUDIT');
  const hasPortalAccess = getAccess('PORTAL');
  return {
    hasSalesAccess,
    hasAuditAccess,
    hasPortalAccess,
    hasOnlyAuditAccess: hasAuditAccess && !hasSalesAccess,
    hasOnlyPortalAccess: hasPortalAccess && !hasSalesAccess && !hasAuditAccess,
  };
}

export function getSalesModuleRedirect(
  profile: AppAccessProfile,
  moduleKey?: string | null
): 'audit-dashboard' | 'portal-dashboard' | null {
  const normalizedModule = String(moduleKey || '').toLowerCase() === 'people' ? 'contacts' : String(moduleKey || '').toLowerCase();
  if (!SALES_MODULES.has(normalizedModule)) return null;
  if (profile.hasOnlyAuditAccess) return 'audit-dashboard';
  if (profile.hasOnlyPortalAccess) return 'portal-dashboard';
  return null;
}

export function getSalesDashboardRedirect(
  profile: AppAccessProfile
): 'audit-dashboard' | 'portal-dashboard' | null {
  if (profile.hasOnlyAuditAccess) return 'audit-dashboard';
  if (profile.hasOnlyPortalAccess) return 'portal-dashboard';
  return null;
}
