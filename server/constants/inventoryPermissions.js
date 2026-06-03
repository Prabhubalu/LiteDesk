/**
 * Inventory RBAC keys (module: inventory).
 */

const INVENTORY_PERMISSIONS = {
  view: 'view',
  adjust: 'adjust',
  transfer: 'transfer',
  count: 'count',
  manageLocations: 'manageLocations',
  rebuildBalances: 'rebuildBalances',
  overrideNegative: 'overrideNegative'
};

const INVENTORY_PERMISSION_KEYS = Object.values(INVENTORY_PERMISSIONS);

function buildDefaultInventoryRolePermissions() {
  return {
    view: true,
    adjust: true,
    transfer: false,
    count: false,
    manageLocations: true,
    rebuildBalances: false,
    overrideNegative: false
  };
}

module.exports = {
  INVENTORY_PERMISSIONS,
  INVENTORY_PERMISSION_KEYS,
  buildDefaultInventoryRolePermissions
};
