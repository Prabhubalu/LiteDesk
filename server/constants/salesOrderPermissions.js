/**
 * Sales Orders RBAC keys (module: sales_orders).
 */

const SALES_ORDER_PERMISSIONS = {
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  confirm: 'confirm',
  fulfill: 'fulfill',
  cancel: 'cancel',
  split: 'split',
  merge: 'merge',
  convertFromQuote: 'convertFromQuote',
  overridePricing: 'overridePricing',
  invoice: 'invoice'
};

const SALES_ORDER_PERMISSION_KEYS = Object.values(SALES_ORDER_PERMISSIONS);

function buildDefaultSalesOrderRolePermissions() {
  return {
    create: true,
    edit: true,
    delete: true,
    confirm: true,
    fulfill: true,
    cancel: true,
    split: false,
    merge: false,
    convertFromQuote: true,
    overridePricing: false,
    invoice: false
  };
}

module.exports = {
  SALES_ORDER_PERMISSIONS,
  SALES_ORDER_PERMISSION_KEYS,
  buildDefaultSalesOrderRolePermissions
};
