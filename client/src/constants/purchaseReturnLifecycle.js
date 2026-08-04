/** PR lifecycle status values + PM-facing labels (mirrors server procurementLifecycle). */

export const PR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  RETURNED: 'returned',
  PARTIALLY_SETTLED: 'partially_settled',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
  PENDING_APPROVAL: 'pending_approval',
  CLOSED: 'closed'
});

export const PR_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  approved: 'Approved',
  returned: 'Returned',
  partially_settled: 'Partially Settled',
  settled: 'Settled',
  cancelled: 'Cancelled',
  pending_approval: 'Pending Approval',
  closed: 'Settled'
});

export const PR_RETURN_TYPE_LABELS = Object.freeze({
  goods_return: 'Goods Return',
  replacement: 'Replacement',
  warranty_return: 'Warranty Return',
  quality_rejection: 'Quality Rejection',
  supplier_recall: 'Supplier Recall'
});

export function formatPurchaseReturnStatus(status) {
  const key = String(status || '').toLowerCase().trim();
  return PR_STATUS_LABELS[key] || (key ? String(status) : '—');
}

export function formatPurchaseReturnType(type) {
  const key = String(type || '').toLowerCase().trim();
  return PR_RETURN_TYPE_LABELS[key] || (key ? String(type) : '—');
}

export function isPurchaseReturnEditable(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}

export function canApprovePurchaseReturn(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}

export function canMarkPurchaseReturnReturned(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval' || s === 'approved';
}

export function canCancelPurchaseReturn(status) {
  return canMarkPurchaseReturnReturned(status);
}
