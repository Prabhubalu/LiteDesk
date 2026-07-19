'use strict';

const {
  normalizeStorageModuleKey,
  mapMiddlewareActionToEnvelope
} = require('../services/runtimePermissionResolver');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');

function isExternalPortalUser(user) {
  return String(user?.userType || '').toUpperCase() === 'EXTERNAL';
}

function readPermissionsRoot(user) {
  const runtimeEnvelope = user?._permissionRuntime?.envelope;
  if (runtimeEnvelope && typeof runtimeEnvelope === 'object') {
    return runtimeEnvelope;
  }
  return user?.permissions || null;
}

function readModuleEnvelope(user, moduleKey) {
  const mod = normalizeStorageModuleKey(moduleKey);
  const root = readPermissionsRoot(user);
  const envelope = root?.[mod];
  if (!envelope || typeof envelope !== 'object') {
    if (mod === 'responses' && root?.forms) {
      return root.forms;
    }
    return null;
  }
  return envelope;
}

/**
 * Portal module grant check — uses role envelope directly (no HELPDESK app-key mismatch).
 */
function userPortalModuleGranted(user, moduleKey, action = 'read') {
  if (!user) return false;
  if (user.isOwner === true || isTenantPrivilegedUser(user)) return true;

  const mod = normalizeStorageModuleKey(moduleKey);
  const envelope = readModuleEnvelope(user, mod);
  if (!envelope) return false;

  const normalizedAction = String(action || 'read').toLowerCase();
  if (normalizedAction === 'read' || normalizedAction === 'view') {
    return envelope.read === true || envelope.view === true;
  }
  if (normalizedAction === 'create') {
    return envelope.create === true;
  }
  if (normalizedAction === 'update' || normalizedAction === 'edit') {
    return envelope.update === true || envelope.edit === true;
  }
  if (normalizedAction === 'delete') {
    return envelope.delete === true;
  }

  const envelopeAction = mapMiddlewareActionToEnvelope(action);
  return envelope[envelopeAction] === true;
}

function userModuleView(user, moduleKey) {
  return userPortalModuleGranted(user, moduleKey, 'read');
}

function userPortalModuleGrantedAny(user, moduleKey, actions = ['read']) {
  const list = Array.isArray(actions) ? actions : [actions];
  return list.some((action) => userPortalModuleGranted(user, moduleKey, action));
}

function hasHydratedPermissionEnvelope(user) {
  const permissions = user?.permissions;
  if (!permissions || typeof permissions !== 'object') return false;
  return Object.keys(permissions).length > 0;
}

module.exports = {
  isExternalPortalUser,
  userPortalModuleGranted,
  userPortalModuleGrantedAny,
  userModuleView,
  hasHydratedPermissionEnvelope,
  readModuleEnvelope
};
