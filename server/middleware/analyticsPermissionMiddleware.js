/**
 * Analytics permission middleware — maps analytics module keys to legacy reports RBAC (A1 transitional).
 */

const securityLogger = require('./securityLoggingMiddleware');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const {
  ANALYTICS_MODULE_KEYS,
  hasAnalyticsPermission,
  normalizeAnalyticsAction,
} = require('../permissions/analyticsPermissions');
const { resolveRuntimePermission } = require('../services/runtimePermissionResolver');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');

const SECURITY_DISABLED =
  process.env.DISABLE_SECURITY === 'true' || process.env.NODE_ENV !== 'production';

/** @type {Record<string, { legacyModule: string, legacyAction: string }>} */
const ANALYTICS_ACTION_FALLBACK = Object.freeze({
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.read`]: { legacyModule: 'reports', legacyAction: 'view' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.create`]: { legacyModule: 'reports', legacyAction: 'create' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.update`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.delete`]: { legacyModule: 'reports', legacyAction: 'delete' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.execute`]: { legacyModule: 'reports', legacyAction: 'view' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.export`]: { legacyModule: 'reports', legacyAction: 'export' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.publish`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.schedule`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.REPORTS}.share`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.WIDGETS}.read`]: { legacyModule: 'reports', legacyAction: 'view' },
  [`${ANALYTICS_MODULE_KEYS.WIDGETS}.create`]: { legacyModule: 'reports', legacyAction: 'create' },
  [`${ANALYTICS_MODULE_KEYS.WIDGETS}.update`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.WIDGETS}.delete`]: { legacyModule: 'reports', legacyAction: 'delete' },
  [`${ANALYTICS_MODULE_KEYS.WIDGETS}.publish`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.read`]: { legacyModule: 'reports', legacyAction: 'view' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.create`]: { legacyModule: 'reports', legacyAction: 'create' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.update`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.delete`]: { legacyModule: 'reports', legacyAction: 'delete' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.publish`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.DASHBOARDS}.share`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.ADMIN}.read`]: { legacyModule: 'reports', legacyAction: 'view' },
  [`${ANALYTICS_MODULE_KEYS.ADMIN}.update`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.ADMIN}.manageSettings`]: { legacyModule: 'reports', legacyAction: 'edit' },
  [`${ANALYTICS_MODULE_KEYS.ADMIN}.certify`]: { legacyModule: 'reports', legacyAction: 'edit' },
});

function resolveLegacyFallback(moduleKey, action) {
  const normalized = normalizeAnalyticsAction(action);
  return ANALYTICS_ACTION_FALLBACK[`${moduleKey}.${normalized}`] || null;
}

function userPermissionsPlain(user) {
  const p = user?.permissions;
  if (!p) return {};
  return typeof p.toObject === 'function' ? p.toObject() : { ...p };
}

/**
 * @param {string} moduleKey - analytics_reports | analytics_widgets | …
 * @param {string} action - read | create | execute | …
 */
function checkAnalyticsPermission(moduleKey, action) {
  return async (req, res, next) => {
    if (SECURITY_DISABLED) {
      return next();
    }

    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (user.isOwner || isTenantPrivilegedUser(user)) {
        return next();
      }

      const normalizedAction = normalizeAnalyticsAction(action);
      const envelope = userPermissionsPlain(user);

      if (hasAnalyticsPermission(envelope, moduleKey, normalizedAction)) {
        return next();
      }

      const fallback = resolveLegacyFallback(moduleKey, normalizedAction);
      if (fallback) {
        const orgContext = req.organization
          ? buildOrgPermissionContext(req.organization)
          : user._orgPermissionContext;

        const allowed = resolveRuntimePermission(user, fallback.legacyModule, fallback.legacyAction, {
          appKey: req.appKey,
          orgContext,
        });
        if (allowed) {
          return next();
        }
      }

      securityLogger.logPermissionDenial(req, moduleKey, normalizedAction);
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${normalizedAction} ${moduleKey}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredPermission: { module: moduleKey, action: normalizedAction },
      });
    } catch (err) {
      console.error('Analytics permission check error:', err);
      return res.status(500).json({ success: false, message: 'Server error during permission check' });
    }
  };
}

module.exports = {
  checkAnalyticsPermission,
  resolveLegacyFallback,
};
