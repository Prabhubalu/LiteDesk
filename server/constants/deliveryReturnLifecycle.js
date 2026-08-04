/**
 * Delivery Return lifecycle (sales reverse logistics).
 * Inventory posts only on transition to the configured inventory-post status
 * (default: restocked), not on approve/receive/inspect.
 */

const DR_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  RECEIVED: 'received',
  INSPECTED: 'inspected',
  RESTOCKED: 'restocked',
  CANCELLED: 'cancelled',
  /** @deprecated — treat as draft in UI */
  PENDING_APPROVAL: 'pending_approval',
  /** @deprecated — map to restocked for legacy workbench rows */
  INVENTORY_UPDATED: 'inventory_updated',
  /** @deprecated */
  CLOSED: 'closed'
});

const DR_STATUS_LABELS = Object.freeze({
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

/** Statuses that may progress toward restock (no inventory yet required). */
const DR_EDITABLE_STATUSES = Object.freeze([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL
]);

const DR_APPROVABLE_STATUSES = Object.freeze([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL
]);

const DR_RECEIVABLE_STATUSES = Object.freeze([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL,
  DR_STATUSES.APPROVED
]);

const DR_INSPECTABLE_STATUSES = Object.freeze([
  DR_STATUSES.RECEIVED
]);

const DR_RESTOCKABLE_STATUSES = Object.freeze([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL,
  DR_STATUSES.APPROVED,
  DR_STATUSES.RECEIVED,
  DR_STATUSES.INSPECTED
]);

const DR_CANCELLABLE_STATUSES = Object.freeze([
  DR_STATUSES.DRAFT,
  DR_STATUSES.PENDING_APPROVAL,
  DR_STATUSES.APPROVED,
  DR_STATUSES.RECEIVED,
  DR_STATUSES.INSPECTED
]);

/**
 * Default status on which warehouse inventory is increased.
 * Orgs can override via header `inventoryPostStatus` later; service defaults here.
 */
const DR_DEFAULT_INVENTORY_POST_STATUS = DR_STATUSES.RESTOCKED;

/** DN statuses that may supply returnable delivered quantity */
const DR_SOURCE_DN_STATUSES = Object.freeze([
  'dispatched',
  'partially_delivered',
  'delivered',
  'closed'
]);

const DR_RETURN_TYPES = Object.freeze([
  'customer_return',
  'warranty_return',
  'replacement',
  'damaged_goods',
  'product_recall'
]);

const DR_RETURN_TYPE_LABELS = Object.freeze({
  customer_return: 'Customer Return',
  warranty_return: 'Warranty Return',
  replacement: 'Replacement',
  damaged_goods: 'Damaged Goods',
  product_recall: 'Product Recall'
});

const DR_LINE_RETURN_REASONS = Object.freeze([
  'damaged_product',
  'wrong_item',
  'quality_issue',
  'expired_product',
  'warranty_replacement',
  'excess_delivery',
  'customer_rejection',
  'product_recall'
]);

const DR_LINE_RETURN_REASON_LABELS = Object.freeze({
  damaged_product: 'Damaged Product',
  wrong_item: 'Wrong Item Delivered',
  quality_issue: 'Quality Issue',
  expired_product: 'Expired Product',
  warranty_replacement: 'Warranty Replacement',
  excess_delivery: 'Excess Delivery',
  customer_rejection: 'Customer Rejection',
  product_recall: 'Product Recall'
});

const DR_SOURCE_TYPES = Object.freeze({
  DELIVERY_NOTE: 'delivery_note',
  INVOICE: 'invoice'
});

module.exports = {
  DR_STATUSES,
  DR_STATUS_VALUES: Object.values(DR_STATUSES),
  DR_STATUS_LABELS,
  DR_EDITABLE_STATUSES,
  DR_APPROVABLE_STATUSES,
  DR_RECEIVABLE_STATUSES,
  DR_INSPECTABLE_STATUSES,
  DR_RESTOCKABLE_STATUSES,
  DR_CANCELLABLE_STATUSES,
  DR_DEFAULT_INVENTORY_POST_STATUS,
  DR_SOURCE_DN_STATUSES,
  DR_RETURN_TYPES,
  DR_RETURN_TYPE_LABELS,
  DR_LINE_RETURN_REASONS,
  DR_LINE_RETURN_REASON_LABELS,
  DR_SOURCE_TYPES
};
