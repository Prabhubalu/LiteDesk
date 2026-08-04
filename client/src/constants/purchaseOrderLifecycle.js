/** PO lifecycle status values + PM-facing labels (mirrors server procurementLifecycle). */

export const PO_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  ORDERED: 'ordered',
  PARTIALLY_RECEIVED: 'partially_received',
  FULLY_RECEIVED: 'fully_received',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

export const PO_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  ordered: 'Ordered',
  partially_received: 'Partially Received',
  fully_received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled'
});

export function formatPurchaseOrderStatus(status) {
  const key = String(status || '').toLowerCase().trim();
  return PO_STATUS_LABELS[key] || (key ? String(status) : '—');
}
