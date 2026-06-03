const SALES_ORDER_LINEAGE_TYPES = [
  'standalone',
  'split_parent',
  'split_child',
  'merged_result',
  'merged_source'
];

const SALES_ORDER_INVOICE_STATUSES = ['not_invoiced', 'partially_invoiced', 'fully_invoiced'];

const SALES_ORDER_INVOICE_ALLOCATION_TYPES = ['standard', 'progress', 'milestone', 'deposit', 'credit_reversal'];

const SALES_ORDER_INVOICE_ALLOCATION_STATUSES = ['active', 'reversed'];

const SALES_ORDER_SPLIT_BLOCKED_STATUSES = new Set(['Cancelled', 'Closed', 'On Hold']);

const SALES_ORDER_MERGE_ALLOWED_STATUSES = new Set(['Draft', 'Confirmed']);

function isValidLineageType(value) {
  return SALES_ORDER_LINEAGE_TYPES.includes(String(value || '').trim());
}

function isValidInvoiceStatus(value) {
  return SALES_ORDER_INVOICE_STATUSES.includes(String(value || '').trim());
}

module.exports = {
  SALES_ORDER_LINEAGE_TYPES,
  SALES_ORDER_INVOICE_STATUSES,
  SALES_ORDER_INVOICE_ALLOCATION_TYPES,
  SALES_ORDER_INVOICE_ALLOCATION_STATUSES,
  SALES_ORDER_SPLIT_BLOCKED_STATUSES,
  SALES_ORDER_MERGE_ALLOWED_STATUSES,
  isValidLineageType,
  isValidInvoiceStatus
};
