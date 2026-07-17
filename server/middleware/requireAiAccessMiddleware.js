const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');

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

function requireAiAccess(action = 'use') {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (
      process.env.DISABLE_SECURITY === 'true' ||
      process.env.NODE_ENV !== 'production' ||
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
      message: 'AI permission required',
      code: 'AI_PERMISSION_REQUIRED',
      action,
    });
  };
}

module.exports = {
  requireAiAccess,
};
