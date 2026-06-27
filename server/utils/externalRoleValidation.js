'use strict';

const appRegistry = require('../constants/appRegistry');
const Role = require('../models/Role');
const { validateAppRole } = require('./appAccessUtils');

function normalizeUserType(userType) {
  return String(userType || 'INTERNAL').toUpperCase();
}

function validateExternalAppEntitlements(appEntitlements = []) {
  if (!Array.isArray(appEntitlements) || appEntitlements.length === 0) {
    return 'External roles require at least one app entitlement';
  }

  for (const entry of appEntitlements) {
    const appKey = String(entry?.appKey || '').toUpperCase();
    if (!appKey) {
      return 'App entitlement is missing appKey';
    }
    const registry = appRegistry[appKey];
    if (!registry) {
      return `Unknown app entitlement: ${appKey}`;
    }
    if (!registry.userTypesAllowed.includes('EXTERNAL')) {
      return `External roles cannot include ${appKey} app access`;
    }
    const roleKey = String(entry?.appRoleKey || registry.defaultRole || '').toUpperCase();
    if (!validateAppRole(appKey, roleKey)) {
      return `Invalid app role ${roleKey} for ${appKey}`;
    }
  }

  return null;
}

async function validateExternalRoleParent(parentRoleId, organizationId) {
  if (!parentRoleId) {
    return null;
  }
  const parent = await Role.findOne({
    _id: parentRoleId,
    organizationId
  })
    .select('userType')
    .lean();
  if (!parent) {
    return 'Parent role not found';
  }
  if (normalizeUserType(parent.userType) !== 'EXTERNAL') {
    return 'External roles cannot report to internal roles';
  }
  return null;
}

/**
 * @param {object} payload — role create/update body
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function validateExternalRolePayload(payload, organizationId) {
  if (normalizeUserType(payload.userType) !== 'EXTERNAL') {
    return null;
  }

  const entitlementError = validateExternalAppEntitlements(payload.appEntitlements);
  if (entitlementError) {
    return entitlementError;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'parentRole')) {
    const parentError = await validateExternalRoleParent(payload.parentRole, organizationId);
    if (parentError) {
      return parentError;
    }
  }

  return null;
}

module.exports = {
  validateExternalRolePayload,
  validateExternalAppEntitlements,
  validateExternalRoleParent
};
