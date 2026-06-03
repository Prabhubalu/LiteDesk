/**
 * INV1 — Reservation authority (ATP soft commit).
 */

const InventoryReservation = require('../models/InventoryReservation');
const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const {
  roundQty,
  INVENTORY_RESERVATION_ACTIVE_STATUSES
} = require('../constants/inventoryLifecycle');
const { getDefaultLocation } = require('./inventoryLocationService');
const { getBalance, recomputeItemInventory } = require('./inventoryRollupService');
const { getOrCreateSettings } = require('./inventorySettingsService');
const {
  listInventoryEligibleLines,
  getOpenLineQuantity
} = require('./inventoryLineEligibilityService');
const { writeInventoryActivity } = require('./inventoryActivityService');
const { computeAtp } = require('../constants/inventoryLifecycle');

function remainingReservationQty(reservation) {
  return roundQty(
    Math.max(0, roundQty(reservation.quantity) - roundQty(reservation.quantityConsumed || 0))
  );
}

async function sumActiveReservedQty({ organizationId, variantId, inventoryLocationId }) {
  const rows = await InventoryReservation.aggregate([
    {
      $match: {
        organizationId,
        variantId,
        inventoryLocationId,
        status: { $in: INVENTORY_RESERVATION_ACTIVE_STATUSES }
      }
    },
    {
      $project: {
        remaining: { $subtract: ['$quantity', '$quantityConsumed'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$remaining' }
      }
    }
  ]);

  return roundQty(rows[0]?.total || 0);
}

async function refreshReservedRollup({ organizationId, variantId, inventoryLocationId }) {
  const reserved = await sumActiveReservedQty({ organizationId, variantId, inventoryLocationId });
  return recomputeItemInventory({
    organizationId,
    variantId,
    inventoryLocationId,
    reserved
  });
}

async function findActiveReservation({
  organizationId,
  salesOrderLineId,
  variantId,
  inventoryLocationId
}) {
  return InventoryReservation.findOne({
    organizationId,
    salesOrderLineId: String(salesOrderLineId),
    variantId,
    inventoryLocationId,
    status: { $in: INVENTORY_RESERVATION_ACTIVE_STATUSES }
  });
}

async function reserveLine({
  organizationId,
  salesOrderId,
  salesOrderLineId,
  variantId,
  inventoryLocationId,
  requestedQty,
  userId,
  settings
}) {
  const qtyRequested = roundQty(requestedQty);
  if (qtyRequested <= 0) {
    return { reservedQty: 0, backorderQty: 0, reservation: null, duplicate: false };
  }

  const existing = await findActiveReservation({
    organizationId,
    salesOrderLineId,
    variantId,
    inventoryLocationId
  });

  if (existing) {
    return {
      reservedQty: remainingReservationQty(existing),
      backorderQty: 0,
      reservation: existing.toObject(),
      duplicate: true
    };
  }

  const atpOnHand = roundQty((await getBalance({ organizationId, variantId, inventoryLocationId }))?.onHand || 0);
  const atpReserved = await sumActiveReservedQty({ organizationId, variantId, inventoryLocationId });
  const available = computeAtp({ onHand: atpOnHand, reserved: atpReserved });
  const reservedQty = roundQty(Math.min(qtyRequested, Math.max(0, available)));
  const backorderQty = roundQty(Math.max(0, qtyRequested - reservedQty));

  if (settings?.blockConfirmOnInsufficientStock && backorderQty > 0) {
    const err = new Error('Insufficient ATP to confirm sales order');
    err.code = 'INSUFFICIENT_ATP';
    err.details = { salesOrderLineId, variantId, qtyRequested, available, backorderQty };
    throw err;
  }

  if (reservedQty <= 0) {
    return { reservedQty: 0, backorderQty, reservation: null, duplicate: false };
  }

  const order = await SalesOrder.findOne({ _id: salesOrderId, organizationId })
    .select('salesOrderId')
    .lean();

  const reservation = await InventoryReservation.create({
    organizationId,
    variantId,
    inventoryLocationId,
    quantity: reservedQty,
    quantityConsumed: 0,
    status: 'active',
    salesOrderId,
    salesOrderLineId: String(salesOrderLineId),
    sourceContext: 'so_confirm',
    sourceRef: {
      moduleKey: 'sales_orders',
      recordId: order?.salesOrderId ? String(order.salesOrderId) : String(salesOrderId),
      lineId: String(salesOrderLineId)
    },
    reservedAt: new Date()
  });

  await refreshReservedRollup({ organizationId, variantId, inventoryLocationId });

  await writeInventoryActivity({
    organizationId,
    recordId: reservation.inventoryReservationId,
    userId,
    action: 'inventory_reservation_created',
    message: `Reserved ${reservedQty} for sales order line`,
    details: {
      inventoryReservationId: reservation.inventoryReservationId,
      salesOrderLineId,
      variantId: String(variantId),
      quantity: reservedQty,
      backorderQty
    }
  });

  return {
    reservedQty,
    backorderQty,
    reservation: reservation.toObject(),
    duplicate: false
  };
}

async function reserveForSalesOrder({ organizationId, salesOrderId, userId = null }) {
  const order = await SalesOrder.findOne({ _id: salesOrderId, organizationId });
  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const settings = await getOrCreateSettings(organizationId);
  const location = await getDefaultLocation(organizationId, userId);
  const lines = await listInventoryEligibleLines({
    organizationId,
    salesOrderId,
    order
  });

  const results = [];

  for (const line of lines) {
    const openQty = getOpenLineQuantity(line);
    if (openQty <= 0) continue;

    const result = await reserveLine({
      organizationId,
      salesOrderId: order._id,
      salesOrderLineId: line.salesOrderLineId,
      variantId: line.variantId,
      inventoryLocationId: location.inventoryLocationId,
      requestedQty: openQty,
      userId,
      settings
    });

    if (result.backorderQty > 0) {
      await SalesOrderLine.updateOne(
        { organizationId, salesOrderLineId: line.salesOrderLineId },
        {
          $inc: { quantityBackordered: result.backorderQty },
          $set: { fulfillmentStatus: 'Backordered' }
        }
      );
    }

    results.push({
      salesOrderLineId: line.salesOrderLineId,
      variantId: line.variantId,
      ...result
    });
  }

  return { location, reservations: results };
}

async function releaseReservationRecord(reservation, { userId, reason, status = 'released' }) {
  if (!INVENTORY_RESERVATION_ACTIVE_STATUSES.includes(reservation.status)) {
    return { released: false, reservation: reservation.toObject?.() || reservation };
  }

  reservation.status = status;
  reservation.releasedAt = new Date();
  reservation.releasedBy = userId || null;
  reservation.releaseReason = reason || null;
  await reservation.save();

  await refreshReservedRollup({
    organizationId: reservation.organizationId,
    variantId: reservation.variantId,
    inventoryLocationId: reservation.inventoryLocationId
  });

  await writeInventoryActivity({
    organizationId: reservation.organizationId,
    recordId: reservation.inventoryReservationId,
    userId,
    action: status === 'cancelled' ? 'inventory_reservation_cancelled' : 'inventory_reservation_released',
    message: `Reservation ${status}`,
    details: {
      inventoryReservationId: reservation.inventoryReservationId,
      salesOrderLineId: reservation.salesOrderLineId,
      reason
    }
  });

  return { released: true, reservation: reservation.toObject() };
}

async function releaseForSalesOrder({
  organizationId,
  salesOrderId,
  salesOrderLineId = null,
  userId = null,
  reason = 'sales_order_cancelled',
  status = 'cancelled'
}) {
  const query = {
    organizationId,
    salesOrderId,
    status: { $in: INVENTORY_RESERVATION_ACTIVE_STATUSES }
  };

  if (salesOrderLineId) {
    query.salesOrderLineId = String(salesOrderLineId);
  }

  const rows = await InventoryReservation.find(query);
  const released = [];

  for (const reservation of rows) {
    released.push(await releaseReservationRecord(reservation, { userId, reason, status }));
  }

  return released;
}

async function releaseReservationQty({
  organizationId,
  salesOrderLineId,
  variantId,
  inventoryLocationId,
  quantity,
  userId = null,
  reason = 'line_cancelled'
}) {
  const qty = roundQty(quantity);
  if (qty <= 0) return { releasedQty: 0 };

  const reservation = await findActiveReservation({
    organizationId,
    salesOrderLineId,
    variantId,
    inventoryLocationId
  });

  if (!reservation) return { releasedQty: 0 };

  const remaining = remainingReservationQty(reservation);
  const releaseQty = roundQty(Math.min(remaining, qty));

  if (releaseQty >= remaining) {
    await releaseReservationRecord(reservation, { userId, reason, status: 'released' });
    return { releasedQty: releaseQty, reservation: reservation.toObject() };
  }

  reservation.quantity = roundQty(reservation.quantity - releaseQty);
  await reservation.save();
  await refreshReservedRollup({ organizationId, variantId, inventoryLocationId });

  return { releasedQty: releaseQty, reservation: reservation.toObject() };
}

async function consumeReservation({
  organizationId,
  salesOrderLineId,
  variantId,
  inventoryLocationId,
  quantity,
  userId = null,
  ledgerEntryId = null
}) {
  const qty = roundQty(quantity);
  if (qty <= 0) return { consumedQty: 0 };

  const reservation = await findActiveReservation({
    organizationId,
    salesOrderLineId,
    variantId,
    inventoryLocationId
  });

  if (!reservation) return { consumedQty: 0 };

  const remaining = remainingReservationQty(reservation);
  const consumeQty = roundQty(Math.min(remaining, qty));

  reservation.quantityConsumed = roundQty((Number(reservation.quantityConsumed) || 0) + consumeQty);
  if (ledgerEntryId) {
    reservation.consumedByLedgerEntryIds = [
      ...(reservation.consumedByLedgerEntryIds || []),
      String(ledgerEntryId)
    ];
  }

  if (remainingReservationQty(reservation) <= 0) {
    reservation.status = 'consumed';
  } else {
    reservation.status = 'partially_consumed';
  }

  await reservation.save();
  await refreshReservedRollup({ organizationId, variantId, inventoryLocationId });

  await writeInventoryActivity({
    organizationId,
    recordId: reservation.inventoryReservationId,
    userId,
    action: 'inventory_reservation_consumed',
    message: `Consumed ${consumeQty} from reservation`,
    details: {
      inventoryReservationId: reservation.inventoryReservationId,
      salesOrderLineId,
      quantityConsumed: consumeQty,
      status: reservation.status
    }
  });

  return { consumedQty: consumeQty, reservation: reservation.toObject() };
}

async function restoreReservationConsumption({
  organizationId,
  salesOrderLineId,
  variantId,
  inventoryLocationId,
  quantity,
  userId = null
}) {
  const qty = roundQty(quantity);
  if (qty <= 0) return { restoredQty: 0 };

  const reservation = await InventoryReservation.findOne({
    organizationId,
    salesOrderLineId: String(salesOrderLineId),
    variantId,
    inventoryLocationId,
    status: { $in: ['consumed', 'partially_consumed', 'released', 'cancelled'] }
  }).sort({ updatedAt: -1 });

  if (!reservation) return { restoredQty: 0 };

  const consumed = roundQty(reservation.quantityConsumed || 0);
  const restoreQty = roundQty(Math.min(consumed, qty));
  if (restoreQty <= 0) return { restoredQty: 0 };

  reservation.quantityConsumed = roundQty(consumed - restoreQty);
  reservation.status =
    reservation.quantityConsumed > 0 ? 'partially_consumed' : 'active';
  reservation.releasedAt = null;
  reservation.releasedBy = null;
  reservation.releaseReason = null;
  await reservation.save();

  await refreshReservedRollup({ organizationId, variantId, inventoryLocationId });

  await writeInventoryActivity({
    organizationId,
    recordId: reservation.inventoryReservationId,
    userId,
    action: 'inventory_reservation_restored',
    message: `Restored ${restoreQty} to reservation after fulfillment reversal`,
    details: {
      inventoryReservationId: reservation.inventoryReservationId,
      salesOrderLineId,
      restoredQty: restoreQty
    }
  });

  return { restoredQty: restoreQty, reservation: reservation.toObject() };
}

async function listReservations({
  organizationId,
  salesOrderId = null,
  salesOrderLineId = null,
  variantId = null,
  inventoryLocationId = null,
  status = null,
  limit = 100
}) {
  const query = { organizationId };
  if (salesOrderId) query.salesOrderId = salesOrderId;
  if (salesOrderLineId) query.salesOrderLineId = String(salesOrderLineId);
  if (variantId) query.variantId = variantId;
  if (inventoryLocationId) query.inventoryLocationId = inventoryLocationId;
  if (status) query.status = status;

  return InventoryReservation.find(query).sort({ reservedAt: -1 }).limit(limit).lean();
}

module.exports = {
  remainingReservationQty,
  sumActiveReservedQty,
  refreshReservedRollup,
  reserveForSalesOrder,
  releaseForSalesOrder,
  releaseReservationQty,
  consumeReservation,
  restoreReservationConsumption,
  listReservations
};
