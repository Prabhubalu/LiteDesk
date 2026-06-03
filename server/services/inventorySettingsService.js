/**
 * INV0 — Organization inventory settings.
 */

const OrganizationInventorySettings = require('../models/OrganizationInventorySettings');
const { INVENTORY_ATP_LINE_ADD_POLICY_DEFAULT, INVENTORY_ATP_QUOTE_ACCEPT_POLICY_DEFAULT } = require('../constants/inventoryLifecycle');

async function getOrCreateSettings(organizationId) {
  let settings = await OrganizationInventorySettings.findOne({ organizationId });
  if (!settings) {
    settings = await OrganizationInventorySettings.create({ organizationId });
  }
  return settings;
}

async function getAtpGuardPolicies(organizationId) {
  const settings = await getOrCreateSettings(organizationId);
  return {
    lineAdd: settings.atpLineAddPolicy || INVENTORY_ATP_LINE_ADD_POLICY_DEFAULT,
    quoteAccept: settings.atpQuoteAcceptPolicy || INVENTORY_ATP_QUOTE_ACCEPT_POLICY_DEFAULT
  };
}

async function isNegativeInventoryAllowed({ organizationId, location = null, settings = null }) {
  const resolved = settings || (await getOrCreateSettings(organizationId));
  if (resolved.allowNegativeInventory) return true;
  if (location?.allowNegative) return true;
  return false;
}

module.exports = {
  getOrCreateSettings,
  getAtpGuardPolicies,
  isNegativeInventoryAllowed
};
