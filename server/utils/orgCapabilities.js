const { buildOrgInventoryCapability } = require('../services/inventoryCapabilityService');

function buildOrgCapabilities(organization) {
  return {
    ...buildOrgInventoryCapability(organization)
  };
}

module.exports = {
  buildOrgCapabilities
};
