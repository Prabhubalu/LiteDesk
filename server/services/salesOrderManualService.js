/**
 * SO2 — Manual sales order create + confirm.
 */

const SalesOrder = require('../models/SalesOrder');
const {
  SALES_ORDER_STATUS_DEFAULT,
  assertCanTransitionSalesOrderStatus
} = require('../constants/salesOrderLifecycle');
const {
  SALES_ORDER_FULFILLMENT_MODE_DEFAULT,
  assertValidFulfillmentMode
} = require('../constants/salesOrderFulfillment');
const { ensureDefaultSection } = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { reserveForSalesOrder, releaseForSalesOrder } = require('./inventoryReservationService');

function normalizeNumber(value, { defaultValue = 0 } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * @param {object} params
 */
async function createManualSalesOrder({ organizationId, userId, body = {} }) {
  const fulfillmentMode = assertValidFulfillmentMode(
    body.fulfillmentMode || SALES_ORDER_FULFILLMENT_MODE_DEFAULT
  );

  const cf = body?.customFields && typeof body.customFields === 'object' ? body.customFields : {};

  const order = await SalesOrder.create({
    organizationId,
    orderTitle: body.orderTitle ?? null,
    orderDate: body.orderDate ?? new Date(),
    requestedDeliveryDate: body.requestedDeliveryDate ?? null,
    status: SALES_ORDER_STATUS_DEFAULT,
    fulfillmentMode,
    currency: body.currency ?? 'USD',
    exchangeRateSnapshot: normalizeNumber(body.exchangeRateSnapshot, { defaultValue: 1 }),
    ownerId: body.ownerId ?? userId ?? null,
    customerId: body.customerId ?? null,
    organizationRefId: body.organizationRefId ?? null,
    contactId: body.contactId ?? null,
    dealId: body.dealId ?? null,
    caseId: body.caseId ?? null,
    billToAddressSnapshot: cf.billToAddress ?? cf.billTo ?? body.billToAddressSnapshot ?? null,
    shipToAddressSnapshot: cf.shipToAddress ?? cf.shipTo ?? body.shipToAddressSnapshot ?? null,
    paymentTermsSnapshot: cf.paymentTerms ?? body.paymentTermsSnapshot ?? null,
    sourceType: 'manual',
    lineageType: 'standalone',
    createdBy: userId ?? null,
    modifiedBy: userId ?? null,
    customFields: body.customFields ?? {}
  });

  await ensureDefaultSection({ organizationId, salesOrderId: order._id, lockedSnapshot: false });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_created',
    message: 'Sales order created',
    details: {
      sourceType: 'manual',
      salesOrderId: order.salesOrderId,
      salesOrderNumber: order.salesOrderNumber,
      status: order.status
    }
  });

  return order.toObject();
}

/**
 * @param {object} params
 */
async function confirmSalesOrder({ organizationId, salesOrderRef, userId }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const fromStatus = String(order.status || '');
  assertCanTransitionSalesOrderStatus(fromStatus, 'Confirmed');
  order.status = 'Confirmed';
  order.modifiedBy = userId ?? null;
  await order.save();

  let inventoryReservation = null;
  try {
    inventoryReservation = await reserveForSalesOrder({
      organizationId,
      salesOrderId: order._id,
      userId
    });
  } catch (err) {
    await releaseForSalesOrder({
      organizationId,
      salesOrderId: order._id,
      userId,
      reason: 'confirm_failed',
      status: 'cancelled'
    });
    order.status = fromStatus;
    order.modifiedBy = userId ?? null;
    await order.save();
    throw err;
  }

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_status_changed',
    message: `Status changed: ${fromStatus} → Confirmed`,
    details: { fromStatus, toStatus: 'Confirmed', inventoryReservation }
  });

  return { ...order.toObject(), inventoryReservation };
}

/**
 * @param {object} params
 */
async function cancelSalesOrder({ organizationId, salesOrderRef, userId }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const fromStatus = String(order.status || '');
  assertCanTransitionSalesOrderStatus(fromStatus, 'Cancelled');
  order.status = 'Cancelled';
  order.modifiedBy = userId ?? null;
  await order.save();

  const releasedReservations = await releaseForSalesOrder({
    organizationId,
    salesOrderId: order._id,
    userId,
    reason: 'sales_order_cancelled',
    status: 'cancelled'
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_status_changed',
    message: `Status changed: ${fromStatus} → Cancelled`,
    details: { fromStatus, toStatus: 'Cancelled', releasedReservations }
  });

  return order.toObject();
}

module.exports = {
  createManualSalesOrder,
  confirmSalesOrder,
  cancelSalesOrder
};
