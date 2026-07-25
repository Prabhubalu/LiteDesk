/**
 * Charges RBAC keys (module: charges).
 */

const CHARGE_PERMISSIONS = {
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  configureDefaults: 'configureDefaults'
};

const CHARGE_PERMISSION_KEYS = Object.values(CHARGE_PERMISSIONS);

function buildDefaultChargeRolePermissions() {
  return {
    view: true,
    create: true,
    edit: true,
    delete: false,
    configureDefaults: false
  };
}

module.exports = {
  CHARGE_PERMISSIONS,
  CHARGE_PERMISSION_KEYS,
  buildDefaultChargeRolePermissions
};
