/** Receipt Note lifecycle status values (mirrors server procurementLifecycle). */

export const RN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

export const RN_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  pending_verification: 'Pending Verification',
  verified: 'Verified',
  inventory_updated: 'Inventory Updated',
  closed: 'Closed',
  cancelled: 'Cancelled'
});

export function formatReceiptNoteStatus(status) {
  const key = String(status || '').toLowerCase().trim();
  return RN_STATUS_LABELS[key] || (key ? String(status) : '—');
}

export function canVerifyReceiptNote(status) {
  const s = String(status || '').toLowerCase();
  return s === RN_STATUSES.DRAFT || s === RN_STATUSES.PENDING_VERIFICATION;
}
