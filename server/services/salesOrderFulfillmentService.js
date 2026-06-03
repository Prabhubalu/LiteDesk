/**
 * SO2 — Fulfillment events (append-only operational audit).
 */

const crypto = require('crypto');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderFulfillment = require('../models/SalesOrderFulfillment');
const {
  SALES_ORDER_FULFILLMENT_EVENT_TYPES,
  deriveLineFulfillmentStatus,
  deriveHeaderFulfillmentStatus
} = require('../constants/salesOrderFulfillment');
const { canTransitionSalesOrderStatus } = require('../constants/salesOrderLifecycle');
const { recomputeSalesOrderAndSectionTotals } = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const {
  applyFulfillment,
  shouldApplyInventoryForFulfillmentType
} = require('./inventoryFulfillmentService');
const { releaseReservationQty } = require('./inventoryReservationService');
const { getDefaultLocation } = require('./inventoryLocationService');
const { resolveInventoryDeductionLines } = require('./inventoryLineEligibilityService');
const { isInventoryEnabled } = require('./inventoryCapabilityService');

const FULFILLMENT_BLOCKED_STATUSES = new Set(['Draft', 'On Hold', 'Cancelled', 'Closed']);
const FULFILLMENT_ALLOWED_STATUSES = new Set(['Confirmed', 'In Fulfillment', 'Partially Fulfilled', 'Fulfilled']);

function assertValidFulfillmentType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!SALES_ORDER_FULFILLMENT_EVENT_TYPES.includes(t)) {
    const err = new Error(`Invalid fulfillment type: ${type}`);
    err.code = 'VALIDATION';
    err.details = { fulfillmentType: type };
    throw err;
  }
  return t;
}

function assertCanPostFulfillment(order) {
  const status = String(order?.status || '').trim();
  if (FULFILLMENT_BLOCKED_STATUSES.has(status)) {
    const err = new Error(`Cannot post fulfillment while sales order is ${status}.`);
    err.code = 'FULFILLMENT_NOT_ALLOWED';
    err.details = { status };
    throw err;
  }
  if (!FULFILLMENT_ALLOWED_STATUSES.has(status)) {
    const err = new Error(`Cannot post fulfillment for sales order status ${status}.`);
    err.code = 'FULFILLMENT_NOT_ALLOWED';
    err.details = { status };
    throw err;
  }
}

function assertLineEligibleForFulfillment(line, order) {
  const mode = String(order?.fulfillmentMode || 'hybrid');
  const lineType = String(line?.lineType || 'standard');
  if (mode === 'product' && lineType === 'bundle_component') {
    const err = new Error('Fulfill bundle parent lines in product mode.');
    err.code = 'FULFILL_AT_PARENT';
    err.details = { salesOrderLineId: line.salesOrderLineId };
    throw err;
  }
}

/**
 * @param {string} currentStatus
 * @param {Array} lines
 */
function resolveOrderStatusAfterFulfillment(currentStatus, lines) {
  const fromStatus = String(currentStatus || '').trim();
  if (['Draft', 'On Hold', 'Cancelled', 'Closed'].includes(fromStatus)) {
    return fromStatus;
  }

  const headerFulfillment = deriveHeaderFulfillmentStatus(lines);
  let next = fromStatus;

  if (headerFulfillment === 'Fulfilled' && canTransitionSalesOrderStatus(next, 'Fulfilled')) {
    return 'Fulfilled';
  }

  if (fromStatus === 'Confirmed' && canTransitionSalesOrderStatus('Confirmed', 'In Fulfillment')) {
    next = 'In Fulfillment';
  }

  if (
    (headerFulfillment === 'Partially Fulfilled' || headerFulfillment === 'In Progress') &&
    canTransitionSalesOrderStatus(next, 'Partially Fulfilled')
  ) {
    next = 'Partially Fulfilled';
  }

  if (headerFulfillment === 'Fulfilled' && canTransitionSalesOrderStatus(next, 'Fulfilled')) {
    next = 'Fulfilled';
  }

  return next;
}

/**
 * @param {object} line
 * @param {string} fulfillmentType
 * @param {number} quantityDelta
 */
function applyQuantityDeltaToLine(line, fulfillmentType, quantityDelta) {
  const delta = Number(quantityDelta) || 0;
  if (delta <= 0) {
    const err = new Error('quantityDelta must be > 0');
    err.code = 'VALIDATION';
    throw err;
  }

  const qty = Number(line.quantity) || 0;
  const priorFulfilled = Number(line.quantityFulfilled) || 0;
  const priorCancelled = Number(line.quantityCancelled) || 0;
  const priorBackordered = Number(line.quantityBackordered) || 0;

  const openQty = Math.max(0, qty - priorFulfilled - priorCancelled);

  if (fulfillmentType === 'cancel') {
    if (delta > openQty) {
      const err = new Error('Cancel quantity exceeds open quantity.');
      err.code = 'VALIDATION';
      err.details = { openQty, quantityDelta: delta };
      throw err;
    }
    line.quantityCancelled = priorCancelled + delta;
  } else if (fulfillmentType === 'backorder') {
    if (delta > openQty) {
      const err = new Error('Backorder quantity exceeds open quantity.');
      err.code = 'VALIDATION';
      err.details = { openQty, quantityDelta: delta };
      throw err;
    }
    line.quantityBackordered = priorBackordered + delta;
  } else if (fulfillmentType === 'progress') {
    line.fulfillmentStatus = 'In Progress';
  } else {
    if (delta > openQty) {
      const err = new Error('Fulfillment quantity exceeds open quantity.');
      err.code = 'VALIDATION';
      err.details = { openQty, quantityDelta: delta };
      throw err;
    }
    line.quantityFulfilled = priorFulfilled + delta;
  }

  if (fulfillmentType !== 'progress') {
    line.fulfillmentStatus = deriveLineFulfillmentStatus(line);
  }

  return {
    salesOrderLineId: String(line.salesOrderLineId),
    quantityDelta: delta,
    priorQuantityFulfilled: priorFulfilled,
    newQuantityFulfilled: Number(line.quantityFulfilled) || 0,
    priorQuantityCancelled: priorCancelled,
    newQuantityCancelled: Number(line.quantityCancelled) || 0,
    priorQuantityBackordered: priorBackordered,
    newQuantityBackordered: Number(line.quantityBackordered) || 0
  };
}

async function loadSalesOrderByRef({ organizationId, salesOrderRef }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));
  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return order;
}

async function listSalesOrderFulfillments({ organizationId, salesOrderId }) {
  return SalesOrderFulfillment.find({ organizationId, salesOrderId })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * @param {object} params
 */
async function postSalesOrderFulfillment({
  organizationId,
  salesOrderRef,
  userId,
  body = {}
}) {
  const order = await loadSalesOrderByRef({ organizationId, salesOrderRef });
  assertCanPostFulfillment(order);

  const fulfillmentType = assertValidFulfillmentType(body.fulfillmentType);
  if (fulfillmentType === 'backorder' && !(await isInventoryEnabled(organizationId))) {
    const err = new Error('Backorder fulfillment requires the Inventory app');
    err.code = 'INVENTORY_REQUIRED';
    throw err;
  }
  const lineInputs = Array.isArray(body.lines) ? body.lines : [];
  if (!lineInputs.length) {
    const err = new Error('At least one line delta is required.');
    err.code = 'VALIDATION';
    throw err;
  }

  const lines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    hiddenLine: { $ne: true }
  });

  const lineByPublicId = new Map(lines.map((row) => [String(row.salesOrderLineId), row]));
  const eventLines = [];
  const modifiedLines = [];
  const lineSnapshots = [];

  for (const input of lineInputs) {
    const publicId = String(input?.salesOrderLineId || input?.lineId || '').trim();
    const line = lineByPublicId.get(publicId);
    if (!line) {
      const err = new Error(`Sales order line not found: ${publicId}`);
      err.code = 'LINE_NOT_FOUND';
      throw err;
    }
    assertLineEligibleForFulfillment(line, order);
    lineSnapshots.push({
      quantityFulfilled: line.quantityFulfilled,
      quantityCancelled: line.quantityCancelled,
      quantityBackordered: line.quantityBackordered,
      fulfillmentStatus: line.fulfillmentStatus
    });
    const deltaRow = applyQuantityDeltaToLine(line, fulfillmentType, input.quantityDelta);
    if (input.lotId || input.inventoryLotId) {
      deltaRow.lotId = input.lotId || input.inventoryLotId;
    }
    if (Array.isArray(input.serialNumbers) && input.serialNumbers.length) {
      deltaRow.serialNumbers = input.serialNumbers;
    }
    eventLines.push(deltaRow);
    modifiedLines.push(line);
  }

  const salesOrderFulfillmentId = crypto.randomUUID();
  const inventoryLocationId = body.warehouseId
    ? String(body.warehouseId).trim()
    : (await getDefaultLocation(organizationId, userId)).inventoryLocationId;

  if (shouldApplyInventoryForFulfillmentType(fulfillmentType)) {
    try {
      await applyFulfillment({
        organizationId,
        salesOrderFulfillmentId,
        salesOrderId: order._id,
        order,
        fulfillmentType,
        eventLines,
        inventoryLocationId,
        userId,
        isReversal: false
      });
    } catch (err) {
      for (let i = 0; i < modifiedLines.length; i += 1) {
        Object.assign(modifiedLines[i], lineSnapshots[i]);
      }
      throw err;
    }
  }

  for (const line of modifiedLines) {
    await line.save();
  }

  const refreshedLines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    hiddenLine: { $ne: true }
  }).lean();

  const fulfillmentStatus = deriveHeaderFulfillmentStatus(refreshedLines);
  const nextStatus = resolveOrderStatusAfterFulfillment(order.status, refreshedLines);
  const fromStatus = order.status;

  order.fulfillmentStatus = fulfillmentStatus;
  if (nextStatus !== fromStatus) {
    order.status = nextStatus;
  }
  order.modifiedBy = userId ?? null;
  await order.save();

  await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  const event = await SalesOrderFulfillment.create({
    organizationId,
    salesOrderId: order._id,
    salesOrderFulfillmentId,
    fulfillmentType,
    status: 'posted',
    fulfilledAt: body.fulfilledAt ? new Date(body.fulfilledAt) : new Date(),
    fulfilledBy: userId ?? null,
    lines: eventLines,
    carrier: body.carrier ? String(body.carrier).trim().slice(0, 120) : null,
    trackingNumber: body.trackingNumber ? String(body.trackingNumber).trim().slice(0, 120) : null,
    warehouseId: body.warehouseId ? String(body.warehouseId).trim().slice(0, 120) : inventoryLocationId,
    externalRef: body.externalRef ? String(body.externalRef).trim().slice(0, 200) : null,
    note: body.note ? String(body.note).trim().slice(0, 500) : null
  });

  if (fulfillmentType === 'cancel') {
    for (const eventLine of eventLines) {
      const deductionLines = await resolveInventoryDeductionLines({
        organizationId,
        salesOrderId: order._id,
        order,
        salesOrderLineId: eventLine.salesOrderLineId,
        quantityDelta: eventLine.quantityDelta,
        allLines: lines
      });
      for (const row of deductionLines) {
        await releaseReservationQty({
          organizationId,
          salesOrderLineId: row.salesOrderLineId,
          variantId: row.variantId,
          inventoryLocationId,
          quantity: row.quantityDelta,
          userId,
          reason: 'line_cancelled'
        });
      }
    }
  }

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_fulfillment_posted',
    message: 'Fulfillment posted',
    details: {
      salesOrderFulfillmentId: event.salesOrderFulfillmentId,
      fulfillmentType,
      fromStatus,
      toStatus: order.status,
      fulfillmentStatus,
      lineCount: eventLines.length,
      carrier: event.carrier,
      trackingNumber: event.trackingNumber
    }
  });

  if (nextStatus !== fromStatus) {
    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId,
      action: 'sales_order_status_changed',
      message: `Status changed: ${fromStatus} → ${nextStatus}`,
      details: { fromStatus, toStatus: nextStatus, trigger: 'fulfillment' }
    });
  }

  const updatedOrder = await SalesOrder.findOne({ _id: order._id, organizationId }).lean();

  return {
    fulfillment: event.toObject(),
    salesOrder: updatedOrder,
    lines: refreshedLines
  };
}

/**
 * Roll back qty fields from a posted fulfillment event.
 */
function reverseQuantityDeltaOnLine(line, fulfillmentType, quantityDelta) {
  const delta = Number(quantityDelta) || 0;
  if (delta <= 0) {
    const err = new Error('quantityDelta must be > 0');
    err.code = 'VALIDATION';
    throw err;
  }

  const priorFulfilled = Number(line.quantityFulfilled) || 0;
  const priorCancelled = Number(line.quantityCancelled) || 0;
  const priorBackordered = Number(line.quantityBackordered) || 0;

  if (fulfillmentType === 'cancel') {
    if (delta > priorCancelled) {
      const err = new Error('Reversal exceeds cancelled quantity.');
      err.code = 'VALIDATION';
      err.details = { priorCancelled, quantityDelta: delta };
      throw err;
    }
    line.quantityCancelled = priorCancelled - delta;
  } else if (fulfillmentType === 'backorder') {
    if (delta > priorBackordered) {
      const err = new Error('Reversal exceeds backordered quantity.');
      err.code = 'VALIDATION';
      err.details = { priorBackordered, quantityDelta: delta };
      throw err;
    }
    line.quantityBackordered = priorBackordered - delta;
  } else if (fulfillmentType === 'progress') {
    line.fulfillmentStatus = deriveLineFulfillmentStatus(line);
  } else {
    if (delta > priorFulfilled) {
      const err = new Error('Reversal exceeds fulfilled quantity.');
      err.code = 'VALIDATION';
      err.details = { priorFulfilled, quantityDelta: delta };
      throw err;
    }
    line.quantityFulfilled = priorFulfilled - delta;
    line.fulfillmentStatus = deriveLineFulfillmentStatus(line);
  }

  if (fulfillmentType !== 'progress') {
    line.fulfillmentStatus = deriveLineFulfillmentStatus(line);
  }

  return {
    salesOrderLineId: String(line.salesOrderLineId),
    quantityDelta: delta,
    priorQuantityFulfilled: priorFulfilled,
    newQuantityFulfilled: Number(line.quantityFulfilled) || 0,
    priorQuantityCancelled: priorCancelled,
    newQuantityCancelled: Number(line.quantityCancelled) || 0,
    priorQuantityBackordered: priorBackordered,
    newQuantityBackordered: Number(line.quantityBackordered) || 0
  };
}

function resolveOrderStatusAfterReversal(currentStatus, lines) {
  const fromStatus = String(currentStatus || '').trim();
  if (['Draft', 'On Hold', 'Cancelled', 'Closed'].includes(fromStatus)) {
    return fromStatus;
  }

  const headerFulfillment = deriveHeaderFulfillmentStatus(lines);

  if (headerFulfillment === 'Fulfilled' && canTransitionSalesOrderStatus(fromStatus, 'Fulfilled')) {
    return 'Fulfilled';
  }
  if (
    (headerFulfillment === 'Partially Fulfilled' || headerFulfillment === 'In Progress') &&
    canTransitionSalesOrderStatus(fromStatus, 'Partially Fulfilled')
  ) {
    return 'Partially Fulfilled';
  }
  if (
    (headerFulfillment === 'In Progress' || headerFulfillment === 'Backordered') &&
    canTransitionSalesOrderStatus(fromStatus, 'In Fulfillment')
  ) {
    return 'In Fulfillment';
  }
  if (headerFulfillment === 'Not Started' && fromStatus !== 'Confirmed') {
    return 'Confirmed';
  }
  return fromStatus;
}

function resolveReversalActivityAction(fulfillmentType) {
  const t = String(fulfillmentType || '').trim().toLowerCase();
  if (t === 'ship') return 'shipment_reversed';
  if (t === 'deliver') return 'delivery_reversed';
  return 'fulfillment_reversed';
}

const NON_REVERSIBLE_FULFILLMENT_TYPES = new Set(['progress']);

async function reverseSalesOrderFulfillment({
  organizationId,
  salesOrderRef,
  fulfillmentRef,
  userId,
  body = {}
}) {
  const order = await loadSalesOrderByRef({ organizationId, salesOrderRef });
  assertCanPostFulfillment(order);

  const ref = String(fulfillmentRef || '').trim();
  const original =
    (await SalesOrderFulfillment.findOne({
      organizationId,
      salesOrderId: order._id,
      salesOrderFulfillmentId: ref
    })) ||
    (await SalesOrderFulfillment.findOne({
      organizationId,
      salesOrderId: order._id,
      _id: ref
    }));

  if (!original) {
    const err = new Error('Fulfillment event not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (String(original.status || '') !== 'posted') {
    const err = new Error('Only posted fulfillment events can be reversed.');
    err.code = 'FULFILLMENT_NOT_REVERSIBLE';
    err.details = { status: original.status };
    throw err;
  }

  if (original.reversedByFulfillmentId) {
    const err = new Error('Fulfillment event was already reversed.');
    err.code = 'FULFILLMENT_ALREADY_REVERSED';
    throw err;
  }

  const fulfillmentType = String(original.fulfillmentType || '').trim().toLowerCase();
  if (NON_REVERSIBLE_FULFILLMENT_TYPES.has(fulfillmentType)) {
    const err = new Error(`Fulfillment type "${fulfillmentType}" cannot be reversed.`);
    err.code = 'FULFILLMENT_NOT_REVERSIBLE';
    throw err;
  }

  const lines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    hiddenLine: { $ne: true }
  });

  const lineByPublicId = new Map(lines.map((row) => [String(row.salesOrderLineId), row]));
  const eventLines = [];
  const modifiedLines = [];
  const lineSnapshots = [];

  for (const input of original.lines || []) {
    const publicId = String(input?.salesOrderLineId || '').trim();
    const line = lineByPublicId.get(publicId);
    if (!line) {
      const err = new Error(`Sales order line not found: ${publicId}`);
      err.code = 'LINE_NOT_FOUND';
      throw err;
    }
    assertLineEligibleForFulfillment(line, order);
    lineSnapshots.push({
      quantityFulfilled: line.quantityFulfilled,
      quantityCancelled: line.quantityCancelled,
      quantityBackordered: line.quantityBackordered,
      fulfillmentStatus: line.fulfillmentStatus
    });
    const deltaRow = reverseQuantityDeltaOnLine(line, fulfillmentType, input.quantityDelta);
    eventLines.push(deltaRow);
    modifiedLines.push(line);
  }

  const reversalFulfillmentId = crypto.randomUUID();
  const inventoryLocationId = original.warehouseId
    ? String(original.warehouseId).trim()
    : (await getDefaultLocation(organizationId, userId)).inventoryLocationId;

  if (shouldApplyInventoryForFulfillmentType(fulfillmentType)) {
    try {
      await applyFulfillment({
        organizationId,
        salesOrderFulfillmentId: reversalFulfillmentId,
        salesOrderId: order._id,
        order,
        fulfillmentType,
        eventLines,
        inventoryLocationId,
        userId,
        isReversal: true
      });
    } catch (err) {
      for (let i = 0; i < modifiedLines.length; i += 1) {
        Object.assign(modifiedLines[i], lineSnapshots[i]);
      }
      throw err;
    }
  }

  for (const line of modifiedLines) {
    await line.save();
  }

  const refreshedLines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    hiddenLine: { $ne: true }
  }).lean();

  const fulfillmentStatus = deriveHeaderFulfillmentStatus(refreshedLines);
  const fromStatus = order.status;
  const nextStatus = resolveOrderStatusAfterReversal(fromStatus, refreshedLines);

  order.fulfillmentStatus = fulfillmentStatus;
  if (nextStatus !== fromStatus) {
    order.status = nextStatus;
  }
  order.modifiedBy = userId ?? null;
  await order.save();

  await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  const reversalEvent = await SalesOrderFulfillment.create({
    organizationId,
    salesOrderId: order._id,
    salesOrderFulfillmentId: reversalFulfillmentId,
    fulfillmentType,
    status: 'posted',
    reversesFulfillmentId: original.salesOrderFulfillmentId,
    fulfilledAt: body.reversedAt ? new Date(body.reversedAt) : new Date(),
    fulfilledBy: userId ?? null,
    lines: eventLines,
    warehouseId: inventoryLocationId,
    note: body.reason ? String(body.reason).trim().slice(0, 500) : 'Reversal'
  });

  original.status = 'reversed';
  original.reversedByFulfillmentId = reversalEvent._id;
  await original.save();

  const activityAction = resolveReversalActivityAction(fulfillmentType);
  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: activityAction,
    message: 'Fulfillment reversed',
    details: {
      salesOrderFulfillmentId: reversalEvent.salesOrderFulfillmentId,
      reversesFulfillmentId: original.salesOrderFulfillmentId,
      fulfillmentType,
      fromStatus,
      toStatus: order.status,
      fulfillmentStatus,
      lineCount: eventLines.length,
      reason: body.reason || null
    }
  });

  if (nextStatus !== fromStatus) {
    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId,
      action: 'sales_order_status_changed',
      message: `Status changed: ${fromStatus} → ${nextStatus}`,
      details: { fromStatus, toStatus: nextStatus, trigger: 'fulfillment_reversal' }
    });
  }

  const updatedOrder = await SalesOrder.findOne({ _id: order._id, organizationId }).lean();

  return {
    reversal: reversalEvent.toObject(),
    original: original.toObject(),
    salesOrder: updatedOrder,
    lines: refreshedLines
  };
}

module.exports = {
  assertValidFulfillmentType,
  assertCanPostFulfillment,
  resolveOrderStatusAfterFulfillment,
  resolveOrderStatusAfterReversal,
  applyQuantityDeltaToLine,
  reverseQuantityDeltaOnLine,
  resolveReversalActivityAction,
  listSalesOrderFulfillments,
  postSalesOrderFulfillment,
  reverseSalesOrderFulfillment
};
