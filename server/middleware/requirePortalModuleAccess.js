'use strict';

const {
  userPortalModuleGranted,
  userPortalModuleGrantedAny
} = require('../utils/portalModuleAccess');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const securityLogger = require('./securityLoggingMiddleware');

const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true';

function denyPortalModuleAccess(req, res, moduleKey, action) {
  securityLogger.logPermissionDenial(req, moduleKey, action);
  return res.status(403).json({
    success: false,
    code: 'INSUFFICIENT_PERMISSIONS',
    message: 'You do not have permission to access this portal module.',
    module: moduleKey,
    action
  });
}

function shouldBypassPortalModuleAccess(user) {
  return user?.isOwner === true || isTenantPrivilegedUser(user);
}

/**
 * Enforce portal role module permissions on /portal/* APIs.
 * Uses flat role envelope (cases.read, documents.read, …) — not app-key routing.
 *
 * @param {string} moduleKey
 * @param {string} [action='read']
 */
function requirePortalModuleAccess(moduleKey, action = 'read') {
  return function requirePortalModuleAccessMiddleware(req, res, next) {
    if (SECURITY_DISABLED) {
      return next();
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (shouldBypassPortalModuleAccess(user)) {
      return next();
    }

    if (!userPortalModuleGranted(user, moduleKey, action)) {
      return denyPortalModuleAccess(req, res, moduleKey, action);
    }

    return next();
  };
}

/**
 * Pass when any listed action is granted on the module (e.g. cases create OR update).
 *
 * @param {string} moduleKey
 * @param {string[]} actions
 */
function requirePortalModuleAccessAny(moduleKey, actions) {
  const normalizedActions = Array.isArray(actions) ? actions : [actions];
  return function requirePortalModuleAccessAnyMiddleware(req, res, next) {
    if (SECURITY_DISABLED) {
      return next();
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (shouldBypassPortalModuleAccess(user)) {
      return next();
    }

    if (!userPortalModuleGrantedAny(user, moduleKey, normalizedActions)) {
      return denyPortalModuleAccess(req, res, moduleKey, normalizedActions.join('|'));
    }

    return next();
  };
}

requirePortalModuleAccess.any = requirePortalModuleAccessAny;

module.exports = requirePortalModuleAccess;
