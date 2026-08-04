/**
 * Delivery Note lifecycle (outbound fulfillment).
 * Inventory deducts only on transition to the configured inventory-post status
 * (default: dispatched), not on approve/pick/pack alone — unless configured so.
 */

const DN_STATUSES = Object.freeze({
  DRAFT: 'draft',
  APPROVED: 'approved',
  PICKED: 'picked',
  PACKED: 'packed',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  /** @deprecated — treat as draft/approved in UI */
  READY_FOR_DISPATCH: 'ready_for_dispatch',
  /** @deprecated — map near delivered for analytics */
  PARTIALLY_DELIVERED: 'partially_delivered',
  /** @deprecated */
  CLOSED: 'closed'
});

const DN_STATUS_LABELS = Object.freeze({
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

/** Header editable only while pre-warehouse workflow. */
const DN_EDITABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH
]);

const DN_APPROVABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH
]);

const DN_PICKABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH,
  DN_STATUSES.APPROVED
]);

const DN_PACKABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH,
  DN_STATUSES.APPROVED,
  DN_STATUSES.PICKED
]);

const DN_DISPATCHABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH,
  DN_STATUSES.APPROVED,
  DN_STATUSES.PICKED,
  DN_STATUSES.PACKED
]);

const DN_DELIVERABLE_STATUSES = Object.freeze([
  DN_STATUSES.APPROVED,
  DN_STATUSES.PICKED,
  DN_STATUSES.PACKED,
  DN_STATUSES.DISPATCHED,
  DN_STATUSES.PARTIALLY_DELIVERED
]);

const DN_CANCELLABLE_STATUSES = Object.freeze([
  DN_STATUSES.DRAFT,
  DN_STATUSES.READY_FOR_DISPATCH,
  DN_STATUSES.APPROVED,
  DN_STATUSES.PICKED,
  DN_STATUSES.PACKED
]);

/**
 * Default status on which warehouse inventory is deducted.
 * Orgs can override via header `inventoryPostStatus`.
 */
const DN_DEFAULT_INVENTORY_POST_STATUS = DN_STATUSES.DISPATCHED;

const DN_INVENTORY_POST_STATUSES = Object.freeze([
  DN_STATUSES.PICKED,
  DN_STATUSES.PACKED,
  DN_STATUSES.DISPATCHED,
  DN_STATUSES.DELIVERED
]);

const DN_DELIVERY_METHODS = Object.freeze([
  'courier',
  'transport',
  'pickup',
  'hand_delivery'
]);

const DN_DELIVERY_METHOD_LABELS = Object.freeze({
  courier: 'Courier',
  transport: 'Transport',
  pickup: 'Pickup',
  hand_delivery: 'Hand Delivery'
});

const DN_SOURCE_TYPES = Object.freeze({
  DIRECT: 'direct',
  SALES_ORDER: 'sales_order'
});

const DN_SOURCE_TYPE_LABELS = Object.freeze({
  direct: 'Direct Delivery',
  sales_order: 'Sales Order'
});

/** Status values accepted by mongoose enum (incl. legacy) */
const DN_STATUS_VALUES = Object.freeze([
  ...new Set([
    ...Object.values(DN_STATUSES)
  ])
]);

module.exports = {
  DN_STATUSES,
  DN_STATUS_VALUES,
  DN_STATUS_LABELS,
  DN_EDITABLE_STATUSES,
  DN_APPROVABLE_STATUSES,
  DN_PICKABLE_STATUSES,
  DN_PACKABLE_STATUSES,
  DN_DISPATCHABLE_STATUSES,
  DN_DELIVERABLE_STATUSES,
  DN_CANCELLABLE_STATUSES,
  DN_DEFAULT_INVENTORY_POST_STATUS,
  DN_INVENTORY_POST_STATUSES,
  DN_DELIVERY_METHODS,
  DN_DELIVERY_METHOD_LABELS,
  DN_SOURCE_TYPES,
  DN_SOURCE_TYPE_LABELS
};
