/** Sales return lifecycle statuses + labels (mirrors server fulfillmentDocsService). */

export const SR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

export const SR_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  inventory_updated: 'Inventory Updated',
  closed: 'Closed',
  cancelled: 'Cancelled'
});

export function formatSalesReturnStatus(status) {
  const key = String(status || '').toLowerCase().trim();
  return SR_STATUS_LABELS[key] || (key ? String(status) : '—');
}

export function isSalesReturnEditable(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}

export function canApproveSalesReturn(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}
