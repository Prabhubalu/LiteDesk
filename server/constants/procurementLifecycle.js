/** Purchase Order / Receipt Note / Purchase Return lifecycle + permissions */

const PO_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  PARTIALLY_RECEIVED: 'partially_received',
  FULLY_RECEIVED: 'fully_received',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

const RN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  VERIFIED: 'verified',
  INVENTORY_UPDATED: 'inventory_updated',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

const PR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  RETURNED: 'returned',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
});

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
  RN_STATUSES,
  RN_STATUS_VALUES: Object.values(RN_STATUSES),
  PR_STATUSES,
  PR_STATUS_VALUES: Object.values(PR_STATUSES),
  PO_PERMISSIONS
};
