/**
 * Client-side gates for installable platform addons.
 * Mirrors server isAddonEntitledForOrg via login/profile `entitledAddons`.
 *
 * @param {{ entitledAddons?: Record<string, boolean> | null } | null | undefined} user
 * @param {string} addonKey
 * @returns {boolean}
 */
export function isAddonEntitled(user, addonKey) {
  const key = String(addonKey || '').trim().toLowerCase();
  if (!key) return false;
  if (user?.entitledAddons && typeof user.entitledAddons === 'object') {
    return user.entitledAddons[key] === true;
  }
  return false;
}

export function isStockroomAddonEntitled(user) {
  return isAddonEntitled(user, 'stockroom');
}

export function isCpqAddonEntitled(user) {
  return isAddonEntitled(user, 'cpq');
}
