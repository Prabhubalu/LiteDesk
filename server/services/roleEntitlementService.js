/**
 * Derive user appAccess / allowedApps from Role.appEntitlements.
 */

const { isAppEnabledForOrg } = require('../utils/appAccessUtils');
const { validateAppRole } = require('../utils/appAccessUtils');
const { APP_KEYS } = require('../constants/appKeys');

function normalizeEnabledAppKeys(organization) {
  const enabledApps = organization?.enabledApps || [];
  const keys = new Set();
  for (const entry of enabledApps) {
    if (typeof entry === 'string') {
      keys.add(entry.toUpperCase());
      continue;
    }
    if (entry && typeof entry === 'object') {
      const status = String(entry.status || 'ACTIVE').toUpperCase();
      if (status !== 'ACTIVE') continue;
      const key = entry.appKey;
      if (key) keys.add(String(key).toUpperCase());
    }
  }
  return keys;
}

/**
 * @param {object} roleLean — Role document (lean or hydrated)
 * @param {object} organization
 * @returns {{ appAccess: object[], allowedApps: string[] }}
 */
function deriveAppAccessFromRole(roleLean, organization) {
  const enabledOrgApps = normalizeEnabledAppKeys(organization);
  const entitlements = Array.isArray(roleLean?.appEntitlements) ? roleLean.appEntitlements : [];

  const appAccess = [];
  for (const ent of entitlements) {
    if (!ent || ent.enabled === false) continue;
    const appKey = String(ent.appKey || '').toUpperCase();
    if (!appKey || !enabledOrgApps.has(appKey)) continue;

    let appRoleKey = String(ent.appRoleKey || '').toUpperCase();
    if (!appRoleKey || !validateAppRole(appKey, appRoleKey)) {
      const { getDefaultRoleForApp } = require('../utils/appAccessUtils');
      appRoleKey = getDefaultRoleForApp(appKey) || 'USER';
    }

    appAccess.push({
      appKey,
      roleKey: appRoleKey,
      status: 'ACTIVE',
      addedAt: new Date()
    });
  }

  if (appAccess.length === 0 && enabledOrgApps.has(APP_KEYS.SALES)) {
    appAccess.push({
      appKey: APP_KEYS.SALES,
      roleKey: 'USER',
      status: 'ACTIVE',
      addedAt: new Date()
    });
  }

  return {
    appAccess,
    allowedApps: appAccess.map((a) => a.appKey)
  };
}

/**
 * Build default appEntitlements for a role tier from org enabled apps.
 * @param {object} organization
 * @param {{ salesRoleKey?: string, seatConsuming?: boolean }} options
 */
function buildAppEntitlementsForOrg(organization, options = {}) {
  const salesRoleKey = options.salesRoleKey || 'USER';
  const seatConsuming = options.seatConsuming !== false;
  const enabled = normalizeEnabledAppKeys(organization);
  const entitlements = [];

  if (enabled.has(APP_KEYS.SALES)) {
    entitlements.push({
      appKey: APP_KEYS.SALES,
      enabled: true,
      seatConsuming,
      appRoleKey: salesRoleKey
    });
  }

  return entitlements;
}

/**
 * Map role name to legacy user.role enum shim.
 * @param {string} roleName
 */
function mapRoleNameToLegacyEnum(roleName) {
  const n = String(roleName || '').trim().toLowerCase();
  if (n === 'owner') return 'owner';
  if (n === 'administrator' || n === 'admin') return 'admin';
  if (n === 'sales manager' || n === 'manager') return 'manager';
  if (n === 'sales executive' || n === 'user') return 'user';
  if (n === 'viewer') return 'viewer';
  return 'user';
}

module.exports = {
  deriveAppAccessFromRole,
  buildAppEntitlementsForOrg,
  mapRoleNameToLegacyEnum,
  normalizeEnabledAppKeys
};
