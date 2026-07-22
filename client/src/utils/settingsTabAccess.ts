type SettingsAccessCtx = {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: Record<string, any> | null | undefined;
};

function isPrivilegedSettingsRole(role: string | null | undefined): boolean {
  const normalized = String(role || '').toLowerCase();
  return normalized === 'admin' || normalized === 'owner';
}

function hasWorkspaceSettingsAdminAccess(permissions: Record<string, any> | null | undefined): boolean {
  const settings = permissions?.settings || {};
  return Boolean(
    settings.edit
    || settings.customizeFields
    || settings.manageUsers
    || settings.manageIntegrations
  );
}

/** Webforms admin: settings workspace admins + explicit webforms.* grants. */
export function canManageWebforms(
  ctx: SettingsAccessCtx,
  action: 'view' | 'create' | 'edit' | 'delete' = 'view'
): boolean {
  if (ctx.isOwner || isPrivilegedSettingsRole(ctx.role)) return true;
  if (hasWorkspaceSettingsAdminAccess(ctx.permissions)) return true;

  const webforms = ctx.permissions?.webforms || {};
  if (action === 'view') return Boolean(webforms.view);
  if (action === 'create') return Boolean(webforms.create);
  if (action === 'edit') return Boolean(webforms.edit);
  if (action === 'delete') return Boolean(webforms.delete);
  return false;
}

/**
 * Which Settings sidebar / landing cards a user may see, based on role permissions.
 * Owners and org "Admin" role keep full access; everyone else is limited to explicit settings.* flags.
 */
export function canAccessSettingsTab(
  tabId: string,
  ctx: SettingsAccessCtx
): boolean {
  // Personal profile is always accessible to authenticated users; do not require
  // owner/admin or any settings.* flag to manage your own identity.
  if (tabId === 'profile') return true;

  if (ctx.isOwner) return true;
  if (isPrivilegedSettingsRole(ctx.role)) return true;

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
    case 'addons':
      return Boolean(p.edit || p.manageBilling);
    case 'subscriptions':
      return Boolean(p.manageBilling);
    case 'notifications':
      return Boolean(p.view || p.edit || p.manageUsers);
    case 'security':
      return Boolean(p.edit);
    case 'integrations':
      return Boolean(p.manageIntegrations || p.edit);
    case 'ai':
      return Boolean(p.manageIntegrations || p.edit);
    case 'automation':
      // Same bar as application configuration: assignment routing affects operational behavior org-wide.
      return Boolean(p.edit);
    case 'webforms':
      return canManageWebforms(ctx, 'view');
    case 'performance':
      return Boolean(
        p.edit ||
        ctx.permissions?.performance?.targets?.view ||
        ctx.permissions?.performance?.targets?.create
      );
    case 'business-hours':
      return true;
    case 'audit-log':
      // Admins/owners already short-circuit above; non-privileged never see this tab.
      return false;
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
  'addons',
  'automation',
  'webforms',
  'performance',
  'subscriptions',
  'notifications',
  'security',
  'integrations',
  'ai',
  'business-hours',
  'audit-log',
] as const;

/** True if the user should see the Settings entry or any settings section (not only Overview). */
export function hasAnySettingsAccess(ctx: {
  isOwner: boolean;
  role: string | null | undefined;
  permissions: Record<string, any> | null | undefined;
}): boolean {
  return SETTINGS_TAB_IDS.some((id) => canAccessSettingsTab(id, ctx));
}
