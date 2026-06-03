/**
 * Payments RBAC keys (module: payments).
 */

const PAYMENT_PERMISSIONS = {
  view: 'view',
  record: 'record',
  allocate: 'allocate',
  reverse: 'reverse',
  refund: 'refund',
  applyCredit: 'applyCredit',
  export: 'export',
  managePaymentLinks: 'managePaymentLinks',
  viewGatewayEvents: 'viewGatewayEvents',
  manageReconciliation: 'manageReconciliation'
};

const PAYMENT_PERMISSION_KEYS = Object.values(PAYMENT_PERMISSIONS);

function buildDefaultPaymentRolePermissions() {
  return {
    view: true,
    record: true,
    allocate: true,
    reverse: false,
    refund: false,
    applyCredit: true,
    export: true,
    managePaymentLinks: true,
    viewGatewayEvents: true,
    manageReconciliation: false
  };
}

module.exports = {
  PAYMENT_PERMISSIONS,
  PAYMENT_PERMISSION_KEYS,
  buildDefaultPaymentRolePermissions
};
