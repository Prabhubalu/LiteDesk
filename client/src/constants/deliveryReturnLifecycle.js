/** DR lifecycle status values + PM-facing labels (mirrors server deliveryReturnLifecycle). */

export const DR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  RECEIVED: 'received',
  INSPECTED: 'inspected',
  RESTOCKED: 'restocked',
  CANCELLED: 'cancelled',
  PENDING_APPROVAL: 'pending_approval',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed'
});

export const DR_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  approved: 'Approved',
  received: 'Received',
  inspected: 'Inspected',
  restocked: 'Restocked',
  cancelled: 'Cancelled',
  pending_approval: 'Pending Approval',
  inventory_updated: 'Restocked',
  closed: 'Restocked'
});

export const DR_RETURN_TYPE_LABELS = Object.freeze({
  customer_return: 'Customer Return',
  warranty_return: 'Warranty Return',
  replacement: 'Replacement',
  damaged_goods: 'Damaged Goods',
  product_recall: 'Product Recall'
});

export const DR_SOURCE_TYPE_LABELS = Object.freeze({
  delivery_note: 'Delivery Note',
  invoice: 'Invoice'
});

export function formatDeliveryReturnStatus(status) {
  const key = String(status || '').toLowerCase().trim();
  return DR_STATUS_LABELS[key] || (key ? String(status) : '—');
}

export function formatDeliveryReturnType(type) {
  const key = String(type || '').toLowerCase().trim();
  return DR_RETURN_TYPE_LABELS[key] || (key ? String(type) : '—');
}

export function isDeliveryReturnEditable(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}

export function canApproveDeliveryReturn(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval';
}

export function canMarkDeliveryReturnReceived(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'pending_approval' || s === 'approved';
}

export function canMarkDeliveryReturnInspected(status) {
  const s = String(status || '').toLowerCase();
  return s === 'received' || s === 'approved' || s === 'draft' || s === 'pending_approval';
}

export function canMarkDeliveryReturnRestocked(status) {
  const s = String(status || '').toLowerCase();
  return (
    s === 'draft' ||
    s === 'pending_approval' ||
    s === 'approved' ||
    s === 'received' ||
    s === 'inspected'
  );
}

export function canCancelDeliveryReturn(status) {
  return canMarkDeliveryReturnRestocked(status);
}
