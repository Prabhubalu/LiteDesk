const TenantMailroomConfig = require('../../../models/TenantMailroomConfig');

function isGlobalMailroomEmailEnabled() {
  return String(process.env.MAILROOM_EMAIL_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * Per-tenant Mailroom toggle (Settings → Automation → Mailroom) with optional global override.
 */
async function isMailroomEmailEnabledForOrganization(organizationId) {
  if (isGlobalMailroomEmailEnabled()) return true;
  if (!organizationId) return false;

  const row = await TenantMailroomConfig.findOne({ organizationId })
    .select('enabled')
    .lean();
  return row?.enabled === true;
}

module.exports = {
  isGlobalMailroomEmailEnabled,
  isMailroomEmailEnabledForOrganization
};
