const mongoose = require('mongoose');
const { resolveRuntimePermission } = require('../runtimePermissionResolver');
const { isTenantPrivilegedUser } = require('../../utils/tenantPrivilegedAccess');
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');

function userCanViewAllModuleRecords(user, moduleKey, appKey) {
  if (!user || isTenantPrivilegedUser(user)) return true;
  if (user.isOwner === true) return true;

  const storageModule = moduleKey === 'people' ? 'contacts' : moduleKey;
  const perms =
    user.permissions?.[storageModule] ||
    user.permissions?.[moduleKey] ||
    (moduleKey === 'people' ? user.permissions?.people : null);

  if (!perms) return false;
  if (perms.viewAll === true || perms.scope === 'all') return true;

  const rolePlain = user._permissionRuntime?.rolePlain || {};
  if (rolePlain.canViewAllData === true) return true;

  if (appKey && user._permissionRuntime?.modulesByApp?.[appKey]?.[storageModule]) {
    const appMod = user._permissionRuntime.modulesByApp[appKey][storageModule];
    if (appMod?.viewAll === true || appMod?.scope === 'all') return true;
  }

  return false;
}

/**
 * Ensures user may read module data; returns ownership filter when scoped.
 * @returns {{ allowed: boolean, ownershipMatch?: object }}
 */
function resolveModuleDataAccess(user, moduleKey, options = {}) {
  const config = getAnalyticsModuleConfig(moduleKey);
  if (!config) {
    return { allowed: false, reason: 'UNSUPPORTED_MODULE' };
  }

  if (isTenantPrivilegedUser(user)) {
    return { allowed: true };
  }

  const permissionModule = moduleKey === 'people' ? 'people' : moduleKey;
  const canRead = resolveRuntimePermission(user, permissionModule, 'view', {
    appKey: options.appKey || config.appKey,
    orgContext: options.orgContext,
  });

  if (!canRead) {
    return { allowed: false, reason: 'MODULE_READ_DENIED' };
  }

  if (userCanViewAllModuleRecords(user, moduleKey, config.appKey)) {
    return { allowed: true };
  }

  const userId = user._id || user.id;
  if (!userId) {
    return { allowed: false, reason: 'NO_USER' };
  }

  return {
    allowed: true,
    ownershipMatch: {
      [config.ownershipField]: new mongoose.Types.ObjectId(String(userId)),
    },
  };
}

module.exports = {
  userCanViewAllModuleRecords,
  resolveModuleDataAccess,
};
