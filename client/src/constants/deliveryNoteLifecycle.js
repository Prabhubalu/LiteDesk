/** DN lifecycle status values + PM-facing labels (mirrors server deliveryNoteLifecycle). */

export const DN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  PICKED: 'picked',
  PACKED: 'packed',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  READY_FOR_DISPATCH: 'ready_for_dispatch',
  PARTIALLY_DELIVERED: 'partially_delivered',
  CLOSED: 'closed'
});

export const DN_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  approved: 'Approved',
  picked: 'Picked',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  ready_for_dispatch: 'Ready for Dispatch',
  partially_delivered: 'Partially Delivered',
  closed: 'Closed'
});

export const DN_SOURCE_TYPE_LABELS = Object.freeze({
  direct: 'Direct Delivery',
  sales_order: 'Sales Order'
});

export const DN_DELIVERY_METHOD_LABELS = Object.freeze({
  courier: 'Courier',
  transport: 'Transport',
  pickup: 'Pickup',
  hand_delivery: 'Hand Delivery'
});

export function formatDeliveryNoteStatus(status) {
  const key = String(status || '')
    .toLowerCase()
    .trim();
  return DN_STATUS_LABELS[key] || (key ? String(status) : '—');
}

export function isDeliveryNoteEditable(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'ready_for_dispatch';
}

export function canApproveDeliveryNote(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'ready_for_dispatch';
}

export function canMarkDeliveryNotePicked(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'ready_for_dispatch' || s === 'approved';
}

export function canMarkDeliveryNotePacked(status) {
  const s = String(status || '').toLowerCase();
  return s === 'draft' || s === 'ready_for_dispatch' || s === 'approved' || s === 'picked';
}

export function canMarkDeliveryNoteDispatched(status) {
  const s = String(status || '').toLowerCase();
  return (
    s === 'draft' ||
    s === 'ready_for_dispatch' ||
    s === 'approved' ||
    s === 'picked' ||
    s === 'packed'
  );
}

export function canMarkDeliveryNoteDelivered(status) {
  const s = String(status || '').toLowerCase();
  return (
    s === 'approved' ||
    s === 'picked' ||
    s === 'packed' ||
    s === 'dispatched' ||
    s === 'partially_delivered'
  );
}

export function canCancelDeliveryNote(status) {
  const s = String(status || '').toLowerCase();
  return (
    s === 'draft' ||
    s === 'ready_for_dispatch' ||
    s === 'approved' ||
    s === 'picked' ||
    s === 'packed'
  );
}
