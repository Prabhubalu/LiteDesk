const mongoose = require('mongoose');
const { getTenantOrganizationId } = require('./tenantContext');

function normalizeOrganizationId(organizationId) {
  if (!organizationId) return null;
  if (typeof organizationId === 'object' && organizationId._id) {
    return organizationId._id;
  }
  return organizationId;
}

/**
 * Tenant DB rows may omit organizationId; master DB queries must scope by org.
 */
function buildChatSessionScopeFilter(organizationId) {
  const orgId = normalizeOrganizationId(organizationId);
  const tenantOrgId = getTenantOrganizationId();

  if (tenantOrgId) {
    return {
      $or: [
        { organizationId: tenantOrgId },
        { organizationId: null },
        { organizationId: { $exists: false } },
      ],
    };
  }

  if (orgId) {
    return { organizationId: orgId };
  }

  return {};
}

function isValidSessionObjectId(sessionId) {
  return mongoose.Types.ObjectId.isValid(String(sessionId || '').trim());
}

module.exports = {
  buildChatSessionScopeFilter,
  isValidSessionObjectId,
  normalizeOrganizationId,
};
