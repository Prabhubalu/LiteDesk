/** Purchase Order / Receipt Note / Purchase Return lifecycle + permissions */

const PO_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  /** Issued to vendor (PM: Ordered) */
  ORDERED: 'ordered',
  PARTIALLY_RECEIVED: 'partially_received',
  /** Fully received (PM display: Received) */
  FULLY_RECEIVED: 'fully_received',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

/** PM-facing status labels (internal keys unchanged for data stability). */
const PO_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  ordered: 'Ordered',
  partially_received: 'Partially Received',
  fully_received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled'
});

const PO_RECEIVABLE_STATUSES = Object.freeze([
  PO_STATUSES.APPROVED,
  PO_STATUSES.ORDERED,
  PO_STATUSES.PARTIALLY_RECEIVED
]);

const RN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

/**
 * Purchase Return statuses (PM + legacy).
 * Inventory posts only on transition to `returned` (markReturned), not on approve.
 */
const PR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  RETURNED: 'returned',
  PARTIALLY_SETTLED: 'partially_settled',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
  /** @deprecated — treat as draft/approved in UI */
  PENDING_APPROVAL: 'pending_approval',
  /** @deprecated — treat as settled in UI */
  CLOSED: 'closed'
});

const PR_STATUS_LABELS = Object.freeze({
  draft: 'Draft',
  approved: 'Approved',
  returned: 'Returned',
  partially_settled: 'Partially Settled',
  settled: 'Settled',
  cancelled: 'Cancelled',
  pending_approval: 'Pending Approval',
  closed: 'Settled'
});

/** RN statuses that may supply returnable quantity */
const PR_SOURCE_RN_STATUSES = Object.freeze([
  RN_STATUSES.INVENTORY_UPDATED,
  RN_STATUSES.VERIFIED,
  RN_STATUSES.CLOSED
]);

const PO_PERMISSIONS = Object.freeze({
  view: 'view',
  create: 'create',
  edit: 'edit',
  delete: 'delete',
  approve: 'approve',
  cancel: 'cancel'
});

module.exports = {
  PO_STATUSES,
  PO_STATUS_VALUES: Object.values(PO_STATUSES),
  PO_STATUS_LABELS,
  PO_RECEIVABLE_STATUSES,
  RN_STATUSES,
  RN_STATUS_VALUES: Object.values(RN_STATUSES),
  PR_STATUSES,
  PR_STATUS_VALUES: Object.values(PR_STATUSES),
  PR_STATUS_LABELS,
  PR_SOURCE_RN_STATUSES,
  PO_PERMISSIONS
};
