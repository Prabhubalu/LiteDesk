/**
 * Which Settings sidebar / landing cards a user may see, based on role permissions.
 * Owners and org "Admin" role keep full access; everyone else is limited to explicit settings.* flags.
 */
export function canAccessSettingsTab(
  tabId: string,
  ctx: { isOwner: boolean; role: string | null | undefined; permissions: Record<string, any> | null | undefined }
): boolean {
  // Personal profile is always accessible to authenticated users; do not require
  // owner/admin or any settings.* flag to manage your own identity.
  if (tabId === 'profile') return true;

  if (ctx.isOwner) return true;
  if (String(ctx.role || '').toLowerCase() === 'admin') return true;

  const p = ctx.permissions?.settings || {};

  switch (tabId) {
    case 'organization':
      return Boolean(p.edit || p.view);
    case 'users-access':
      return Boolean(p.manageUsers);
    case 'core-modules':
      return Boolean(p.customizeFields || p.edit);
    case 'applications':
      return Boolean(p.edit);
    case 'subscriptions':
      return Boolean(p.manageBilling);
    case 'notifications':
      return Boolean(p.view || p.edit || p.manageUsers);
    case 'security':
      return Boolean(p.edit);
    case 'integrations':
      return Boolean(p.manageIntegrations || p.edit);
    case 'automation':
      // Same bar as application configuration: assignment routing affects operational behavior org-wide.
      return Boolean(p.edit);
    case 'performance':
      return Boolean(
        p.edit ||
        ctx.permissions?.performance?.targets?.view ||
        ctx.permissions?.performance?.targets?.create
      );
    case 'business-hours':
      return true;
    default:
      return false;
  }
}

const SETTINGS_TAB_IDS = [
  'profile',
  'organization',
  'users-access',
  'core-modules',
  'applications',
  'automation',
  'performance',
  'subscriptions',
  'notifications',
  'security',
  'integrations',
  'business-hours',
] as const;

/** True if the user should see the Settings entry or any settings section (not only Overview). */
export function hasAnySettingsAccess(ctx: {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: Record<string, any> | null | undefined;
}): boolean {
  return SETTINGS_TAB_IDS.some((id) => canAccessSettingsTab(id, ctx));
}
