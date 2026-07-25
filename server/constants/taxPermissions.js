/**
 * Taxes RBAC keys (module: taxes).
 * Enforced on taxRoutes; roles without taxes envelope fall back to items grants.
 */

const TAX_PERMISSIONS = {
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  manageGroups: 'manageGroups',
  configureDefaults: 'configureDefaults'
};

const TAX_PERMISSION_KEYS = Object.values(TAX_PERMISSIONS);

function buildDefaultTaxRolePermissions() {
  return {
    view: true,
    create: true,
    edit: true,
    delete: false,
    manageGroups: true,
    configureDefaults: false
  };
}

module.exports = {
  TAX_PERMISSIONS,
  TAX_PERMISSION_KEYS,
  buildDefaultTaxRolePermissions
};
