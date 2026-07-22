'use strict';

/**
 * Astra v2 access control.
 *
 * IMPORTANT: unlike the legacy requireAiAccess middleware, this has NO
 * non-production bypass. Access is granted ONLY by real ownership, tenant
 * privilege, admin role, or an explicit AI permission — in every environment.
 */

const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const { isAstraV2Enabled } = require('../services/astra/flags');

function hasLegacyAiPermission(user, action) {
  const permissions = user?.permissions || {};
  const aiPermissions = permissions.ai || permissions.AI;
  if (!aiPermissions) return false;
  return Boolean(aiPermissions[action] || aiPermissions.use || aiPermissions.view);
}

function hasAppAiPermission(user, appKey, action) {
  const appPermissions = user?.appPermissions || user?.roleId?.appPermissions;
  if (!appPermissions) return false;
  const appScoped = appPermissions.get?.(appKey) || appPermissions[appKey] || appPermissions.SALES || {};
  const aiPermissions = appScoped.ai || appScoped.AI || {};
  return Boolean(aiPermissions[action] || aiPermissions.use || aiPermissions.view);
}

/** Gate: Astra v2 must be enabled for the platform. */
function requireAstraV2Enabled(req, res, next) {
  if (!isAstraV2Enabled()) {
    return res.status(404).json({
      success: false,
      message: 'Astra v2 is not enabled',
      code: 'ASTRA_V2_DISABLED',
    });
  }
  return next();
}

/**
 * Gate: the authenticated user may use Astra v2. No environment bypass.
 * @param {string} [action] 'use' | 'view' | 'manage'
 */
function requireAstraV2Access(action = 'use') {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (
      user.isOwner ||
      isTenantPrivilegedUser(user) ||
      String(user.role || '').toLowerCase() === 'admin' ||
      hasLegacyAiPermission(user, action) ||
      hasAppAiPermission(user, req.appKey, action)
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Astra AI permission required',
      code: 'ASTRA_V2_PERMISSION_REQUIRED',
      action,
    });
  };
}

module.exports = {
  requireAstraV2Enabled,
  requireAstraV2Access,
};
