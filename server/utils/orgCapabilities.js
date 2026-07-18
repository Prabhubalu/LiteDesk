const { buildOrgInventoryCapability } = require('../services/inventoryCapabilityService');
const { isPortalFrameworkV1Enabled } = require('./portalFeatureFlags');

/**
 * Server-resolved org capabilities for the client session payload.
 * Clients must consume these instead of re-deriving env/org flag OR logic.
 */
function buildOrgCapabilities(organization) {
  return {
    ...buildOrgInventoryCapability(organization),
    portalFrameworkV1: isPortalFrameworkV1Enabled(organization)
  };
}

module.exports = {
  buildOrgCapabilities
};
