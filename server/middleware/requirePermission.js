/**
 * ============================================================================
 * REQUIRE PERMISSION MIDDLEWARE
 * ============================================================================
 *
 * Checks canonical permission strings (e.g. people.attach.sales) through the
 * same runtime resolver as checkPermission — including org-level app/module guards.
 *
 * Backward compatibility:
 * - user.permissions as string[] (exact match fallback)
 * - people → contacts mapping via runtime resolver
 * - App-scoped strings require role grant + user app seat access
 * ============================================================================
 */

const {
  buildOrgPermissionContext,
  getOrgPermissionContextForUser,
  resolveStringPermission,
  passesOrgGuardsForStringPermission,
  parsePermissionString
} = require('../services/runtimePermissionResolver');

const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true';

/**
 * @param {string} permission - Permission string (e.g., 'people.attach.sales')
 * @returns {Function} Express middleware
 */
module.exports = function requirePermission(permission) {
  return async function requirePermissionMiddleware(req, res, next) {
    if (SECURITY_DISABLED) {
      console.warn(`⚠️  [DEV] Permission check bypassed: ${permission}`);
      return next();
    }

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const orgContext = req.organization
      ? buildOrgPermissionContext(req.organization)
      : await getOrgPermissionContextForUser(user);

    if (!user._orgPermissionContext) {
      user._orgPermissionContext = orgContext;
    }

    const parsed = parsePermissionString(permission);
    if (parsed && !passesOrgGuardsForStringPermission(orgContext, parsed)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'This application or module is not enabled for your organization',
        code: 'ORG_MODULE_NOT_ENABLED',
        permission
      });
    }

    if (user.isOwner) {
      return next();
    }

    const allowed = resolveStringPermission(user, permission, {
      appKey: req.appKey,
      orgContext
    });

    if (!allowed) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        permission
      });
    }

    next();
  };
};
