/**
 * Tenant inventory engine entitlement (INVENTORY app ACTIVE).
 * Commercial quote-to-cash does not imply inventory operations.
 */

const Organization = require('../models/Organization');
const { APP_KEYS } = require('../constants/appKeys');
const { isAppEnabledForOrg } = require('../utils/appAccessUtils');

const ATP_GUARD_DISABLED_RESULT = Object.freeze({
  policy: 'off',
  sufficient: true,
  results: [],
  warnings: [],
  inventoryDisabled: true
});

const RESERVATION_SKIPPED_RESULT = Object.freeze({
  skipped: true,
  location: null,
  reservations: []
});

function isInventoryEnabledForOrg(organization) {
  return isAppEnabledForOrg(organization, APP_KEYS.INVENTORY);
}

async function isInventoryEnabled(organizationId, organizationHint = null) {
  if (organizationHint) {
    return isInventoryEnabledForOrg(organizationHint);
  }
  if (!organizationId) return false;
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  return isInventoryEnabledForOrg(org);
}

function buildOrgInventoryCapability(organization) {
  return { inventory: isInventoryEnabledForOrg(organization) };
}

module.exports = {
  ATP_GUARD_DISABLED_RESULT,
  RESERVATION_SKIPPED_RESULT,
  isInventoryEnabledForOrg,
  isInventoryEnabled,
  buildOrgInventoryCapability
};
