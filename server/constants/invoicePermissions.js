/**
 * Invoices RBAC keys (module: invoices).
 */

const INVOICE_PERMISSIONS = {
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  submit: 'submit',
  approve: 'approve',
  post: 'post',
  void: 'void',
  createCreditNote: 'createCreditNote',
  writeOff: 'writeOff',
  overrideBillOnFulfill: 'overrideBillOnFulfill',
  overridePricing: 'overridePricing',
  export: 'export'
};

const INVOICE_PERMISSION_KEYS = Object.values(INVOICE_PERMISSIONS);

function buildDefaultInvoiceRolePermissions() {
  return {
    view: true,
    create: true,
    edit: true,
    delete: true,
    submit: true,
    approve: false,
    post: true,
    void: false,
    createCreditNote: false,
    writeOff: false,
    overrideBillOnFulfill: false,
    overridePricing: false,
    export: true
  };
}

module.exports = {
  INVOICE_PERMISSIONS,
  INVOICE_PERMISSION_KEYS,
  buildDefaultInvoiceRolePermissions
};
