const { ADDON_NAVIGATION_REGISTRY } = require('../constants/addonNavigationRegistry');
const { normalizeAddonKey, ADDON_KEYS } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');

function userHasPermission(user, permissionKey) {
  if (!permissionKey) return true;
  if (user?.isOwner) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;

  const parts = String(permissionKey).split('.');
  if (parts.length < 2) return false;

  let cursor = user?.permissions;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return false;
    cursor = cursor[part];
  }
  return cursor === true;
}

function userCanAccessAddonNav(user, permissionKey) {
  if (!permissionKey) return true;
  if (user?.isOwner) return true;
  const role = String(user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;

  const rootKey = String(permissionKey).split('.')[0];
  const rootPerms = user?.permissions?.[rootKey];
  if (!rootPerms || typeof rootPerms !== 'object') {
    return true;
  }

  if (userHasPermission(user, permissionKey)) return true;

  // Flat liveChat.view/reply flags (materialized envelope) vs nested liveChat.sessions.view.
  if (rootKey === 'liveChat') {
    const flatKey = String(permissionKey).split('.')[1];
    if (flatKey && rootPerms[flatKey] === true) return true;
  }

  if (rootKey === 'announcements') {
    const flatKey = String(permissionKey).split('.')[1];
    if (flatKey && rootPerms[flatKey] === true) return true;
  }

  if (rootKey === 'internalChat') {
    const flatKey = String(permissionKey).split('.')[1];
    if (flatKey && rootPerms[flatKey] === true) return true;
  }

  return false;
}

/**
 * Entitled addon shell nav items for the current tenant user.
 */
async function getAddonNavigationItems(organizationId, user) {
  const items = [];
  const isExternal = String(user?.userType || 'INTERNAL').toUpperCase() === 'EXTERNAL';

  for (const [addonKey, def] of Object.entries(ADDON_NAVIGATION_REGISTRY)) {
    const normalized = normalizeAddonKey(addonKey);
    // Internal Chat is staff-only — never expose to portal/external users.
    if (normalized === ADDON_KEYS.INTERNAL_CHAT && isExternal) {
      continue;
    }
    const entitled = await isAddonEntitledForOrg(organizationId, normalized);
    if (!entitled) continue;

    if (def.permission && !userCanAccessAddonNav(user, def.permission)) {
      continue;
    }

    items.push({
      addonKey: normalized,
      surfaceId: def.surfaceId,
      route: def.route,
      label: def.label,
      icon: def.icon,
      order: def.order ?? 999,
    });
  }

  return items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

module.exports = {
  getAddonNavigationItems,
  userHasPermission,
  userCanAccessAddonNav,
};
