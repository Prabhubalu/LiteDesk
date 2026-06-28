/**
 * SO3 — Merge sales orders (Draft/Confirmed, no fulfillment posted).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const SalesOrderFulfillment = require('../models/SalesOrderFulfillment');
const { recomputeSalesOrderAndSectionTotals } = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { releaseForSalesOrder } = require('./inventoryReservationService');
const { SALES_ORDER_MERGE_ALLOWED_STATUSES } = require('../constants/salesOrderLineage');

const BLOCKED_LINEAGE = new Set(['merged_source', 'merged_result']);

async function loadSalesOrdersByRefs({ organizationId, salesOrderRefs }) {
  const ids = [...new Set((salesOrderRefs || []).map((ref) => String(ref || '').trim()).filter(Boolean))];
  if (ids.length < 2) {
    const err = new Error('At least two sales orders are required to merge.');
    err.code = 'VALIDATION';
    throw err;
  }

  const orders = [];
  for (const ref of ids) {
    const order =
      (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
      (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));
    if (!order) {
      const err = new Error(`Sales order not found: ${ref}`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    orders.push(order);
  }

  return orders;
}

function assertMergeCompatibleOrders(orders) {
  const statuses = new Set(orders.map((order) => String(order.status || '')));
  for (const status of statuses) {
    if (!SALES_ORDER_MERGE_ALLOWED_STATUSES.has(status)) {
      const err = new Error(`Merge requires Draft or Confirmed orders. Found: ${status}`);
      err.code = 'MERGE_NOT_ALLOWED';
      err.details = { status };
      throw err;
    }
  }
  if (statuses.size > 1) {
    const err = new Error('All sales orders must share the same status to merge.');
    err.code = 'MERGE_STATUS_MISMATCH';
    throw err;
  }

  for (const order of orders) {
    const lineage = String(order.lineageType || 'standalone');
    if (BLOCKED_LINEAGE.has(lineage)) {
      const err = new Error('Orders that were already merged cannot be merged again.');
      err.code = 'MERGE_NOT_ALLOWED';
      err.details = { salesOrderId: order.salesOrderId, lineageType: lineage };
      throw err;
    }
    if (order.mergedIntoSalesOrderId) {
      const err = new Error('One or more sales orders were already absorbed by a merge.');
      err.code = 'MERGE_NOT_ALLOWED';
      throw err;
    }
  }

  const orgRefKey = orders.map((order) => String(order.organizationRefId || '')).join('|');
  const contactKey = orders.map((order) => String(order.contactId || '')).join('|');
  const uniqueOrgRefs = new Set(orders.map((order) => String(order.organizationRefId || '')));
  const uniqueContacts = new Set(orders.map((order) => String(order.contactId || '')));
  if (uniqueOrgRefs.size > 1 || uniqueContacts.size > 1) {
    const err = new Error('Merge requires the same customer organization and contact on all orders.');
    err.code = 'MERGE_CUSTOMER_MISMATCH';
    err.details = { organizationRefKey: orgRefKey, contactKey };
    throw err;
  }
}

async function assertNoFulfillmentPosted({ organizationId, orders }) {
  const orderIds = orders.map((order) => order._id);
  const fulfillmentCount = await SalesOrderFulfillment.countDocuments({
    organizationId,
    salesOrderId: { $in: orderIds },
    status: 'posted'
  });
  if (fulfillmentCount > 0) {
    const err = new Error('Merge is blocked when fulfillment has been posted.');
    err.code = 'MERGE_FULFILLMENT_POSTED';
    throw err;
  }

  const fulfilledLines = await SalesOrderLine.countDocuments({
    organizationId,
    salesOrderId: { $in: orderIds },
    quantityFulfilled: { $gt: 0 }
  });
  if (fulfilledLines > 0) {
    const err = new Error('Merge is blocked when lines have fulfilled quantity.');
    err.code = 'MERGE_FULFILLMENT_POSTED';
    throw err;
  }
}

function buildMergedLinePayload(sourceLine, { salesOrderId, salesOrderSectionId, lineOrder }) {
  const row = sourceLine.toObject ? sourceLine.toObject() : { ...sourceLine };
  delete row._id;
  delete row.salesOrderLineId;
  delete row.createdAt;
  delete row.updatedAt;
  row.salesOrderId = salesOrderId;
  row.salesOrderSectionId = salesOrderSectionId;
  row.lineOrder = lineOrder;
  row.parentBundleLineId = null;
  return row;
}

/**
 * @param {object} params
 */
async function mergeSalesOrders({ organizationId, userId, body = {} }) {
  const refs = Array.isArray(body.salesOrderIds) ? body.salesOrderIds : body.orders;
  const sourceOrders = await loadSalesOrdersByRefs({ organizationId, salesOrderRefs: refs });
  assertMergeCompatibleOrders(sourceOrders);
  await assertNoFulfillmentPosted({ organizationId, orders: sourceOrders });

  const primary = sourceOrders[0];
  const mergedOrder = await SalesOrder.create({
    organizationId,
    orderTitle: body.orderTitle ?? `Merged ${sourceOrders.map((o) => o.salesOrderNumber).join(' + ')}`,
    orderDate: primary.orderDate,
    requestedDeliveryDate: primary.requestedDeliveryDate,
    promisedDeliveryDate: primary.promisedDeliveryDate,
    status: primary.status,
    fulfillmentMode: primary.fulfillmentMode,
    currency: primary.currency,
    exchangeRateSnapshot: primary.exchangeRateSnapshot,
    globalDiscountType: primary.globalDiscountType,
    globalDiscountValue: primary.globalDiscountValue,
    globalDiscountAmount: primary.globalDiscountAmount,
    adjustmentTotal: primary.adjustmentTotal,
    assignedTo: primary.assignedTo,
    customerId: primary.customerId,
    organizationRefId: primary.organizationRefId,
    contactId: primary.contactId,
    dealId: primary.dealId,
    caseId: primary.caseId,
    billToAddressSnapshot: primary.billToAddressSnapshot,
    shipToAddressSnapshot: primary.shipToAddressSnapshot,
    paymentTermsSnapshot: primary.paymentTermsSnapshot,
    incotermsSnapshot: primary.incotermsSnapshot,
    termsConditionsSnapshot: primary.termsConditionsSnapshot,
    sourceType: 'merge',
    lineageType: 'merged_result',
    mergedFromSalesOrderIds: sourceOrders.map((order) => order._id),
    createdBy: userId ?? null,
    modifiedBy: userId ?? null,
    customFields: primary.customFields || {}
  });

  const sectionByTitle = new Map();
  let sectionOrder = 0;
  let lineOrder = 1;

  for (const sourceOrder of sourceOrders) {
    const sections = await SalesOrderSection.find({ organizationId, salesOrderId: sourceOrder._id })
      .sort({ sectionOrder: 1, createdAt: 1 })
      .lean();

    for (const section of sections) {
      const title = String(section.sectionTitle || '').trim() || 'General';
      if (!sectionByTitle.has(title)) {
        const payload = { ...section };
        delete payload._id;
        delete payload.salesOrderSectionId;
        delete payload.createdAt;
        delete payload.updatedAt;
        payload.salesOrderId = mergedOrder._id;
        payload.sectionTitle = title;
        payload.sectionOrder = sectionOrder++;
        const created = await SalesOrderSection.create(payload);
        sectionByTitle.set(title, created._id);
      }
    }

    const lines = await SalesOrderLine.find({ organizationId, salesOrderId: sourceOrder._id })
      .sort({ lineOrder: 1, createdAt: 1 });

    const parents = lines.filter((line) => String(line.lineType || '') !== 'bundle_component');
    for (const line of parents) {
      const sectionDoc = line.salesOrderSectionId
        ? await SalesOrderSection.findOne({ _id: line.salesOrderSectionId, organizationId }).lean()
        : null;
      const title = String(sectionDoc?.sectionTitle || 'General').trim() || 'General';
      const targetSectionId = sectionByTitle.get(title) || null;

      const createdParent = await SalesOrderLine.create(
        buildMergedLinePayload(line, {
          salesOrderId: mergedOrder._id,
          salesOrderSectionId: targetSectionId,
          lineOrder: lineOrder++
        })
      );

      if (String(line.lineType || '') === 'bundle_parent') {
        const components = lines.filter(
          (row) => String(row.parentBundleLineId || '') === String(line._id)
        );
        for (const component of components) {
          await SalesOrderLine.create({
            ...buildMergedLinePayload(component, {
              salesOrderId: mergedOrder._id,
              salesOrderSectionId: targetSectionId,
              lineOrder: lineOrder++
            }),
            parentBundleLineId: createdParent._id
          });
        }
      }
    }
  }

  for (const sourceOrder of sourceOrders) {
    sourceOrder.status = 'Cancelled';
    sourceOrder.lineageType = 'merged_source';
    sourceOrder.mergedIntoSalesOrderId = mergedOrder._id;
    sourceOrder.modifiedBy = userId ?? null;
    await sourceOrder.save();

    await releaseForSalesOrder({
      organizationId,
      salesOrderId: sourceOrder._id,
      userId,
      reason: 'sales_order_merged',
      status: 'cancelled'
    });

    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: sourceOrder._id,
      userId,
      action: 'sales_order_merged',
      message: 'Merged into new sales order',
      details: {
        mergedIntoSalesOrderId: mergedOrder.salesOrderId,
        mergedIntoSalesOrderNumber: mergedOrder.salesOrderNumber
      }
    });
  }

  await recomputeSalesOrderAndSectionTotals({ organizationId, salesOrderId: mergedOrder._id });

  const refreshedMerged = await SalesOrder.findOne({ _id: mergedOrder._id, organizationId }).lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: mergedOrder._id,
    userId,
    action: 'sales_order_merged',
    message: 'Sales orders merged',
    details: {
      mergedFromSalesOrderIds: sourceOrders.map((order) => order.salesOrderId),
      mergedFromSalesOrderNumbers: sourceOrders.map((order) => order.salesOrderNumber)
    }
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: mergedOrder._id,
    userId,
    action: 'sales_order_created',
    message: 'Created from merge',
    details: { sourceType: 'merge' }
  });

  return {
    mergedOrder: refreshedMerged,
    sourceOrders: sourceOrders.map((order) => order.toObject())
  };
}

module.exports = {
  assertMergeCompatibleOrders,
  mergeSalesOrders
};
