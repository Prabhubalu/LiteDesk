/**
 * SO3 — Split sales order lineage (move unfulfilled qty to child SO).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const SalesOrderFulfillment = require('../models/SalesOrderFulfillment');
const salesOrderTotalsService = require('./salesOrderTotalsService');
const { recomputeSalesOrderAndSectionTotals } = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { SALES_ORDER_SPLIT_BLOCKED_STATUSES } = require('../constants/salesOrderLineage');
const { deriveLineFulfillmentStatus } = require('../constants/salesOrderFulfillment');

const BLOCKED_LINEAGE = new Set(['merged_source']);

function openLineQuantity(line) {
  const qty = Number(line.quantity) || 0;
  const fulfilled = Number(line.quantityFulfilled) || 0;
  const cancelled = Number(line.quantityCancelled) || 0;
  return Math.max(0, qty - fulfilled - cancelled);
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

function assertCanSplitOrder(order) {
  const status = String(order?.status || '').trim();
  if (SALES_ORDER_SPLIT_BLOCKED_STATUSES.has(status)) {
    const err = new Error(`Cannot split sales order in status ${status}.`);
    err.code = 'SPLIT_NOT_ALLOWED';
    err.details = { status };
    throw err;
  }
  const lineage = String(order?.lineageType || 'standalone');
  if (BLOCKED_LINEAGE.has(lineage)) {
    const err = new Error('Merged source orders cannot be split.');
    err.code = 'SPLIT_NOT_ALLOWED';
    err.details = { lineageType: lineage };
    throw err;
  }
}

function buildChildLinePayload(sourceLine, { salesOrderId, salesOrderSectionId, quantity, parentBundleLineMongoId }) {
  const row = sourceLine.toObject ? sourceLine.toObject() : { ...sourceLine };
  delete row._id;
  delete row.salesOrderLineId;
  delete row.createdAt;
  delete row.updatedAt;
  row.salesOrderId = salesOrderId;
  row.salesOrderSectionId = salesOrderSectionId;
  row.quantity = quantity;
  row.quantityFulfilled = 0;
  row.quantityCancelled = 0;
  row.quantityBackordered = 0;
  row.quantityInvoiced = 0;
  row.fulfillmentStatus = 'Open';
  row.parentBundleLineId = parentBundleLineMongoId ?? null;
  return row;
}

function recomputeLineTotals(line) {
  const computed = salesOrderTotalsService.computeLineTotals(line);
  line.lineSubtotal = computed.lineSubtotal;
  line.lineTaxTotal = computed.lineTaxTotal;
  line.lineTotal = computed.lineTotal;
  line.fulfillmentStatus = deriveLineFulfillmentStatus(line);
}

async function cloneSectionsForChild({ organizationId, parentSalesOrderId, childSalesOrderId }) {
  const sections = await SalesOrderSection.find({ organizationId, salesOrderId: parentSalesOrderId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  const sectionMap = new Map();
  for (const section of sections) {
    const payload = { ...section };
    delete payload._id;
    delete payload.salesOrderSectionId;
    delete payload.createdAt;
    delete payload.updatedAt;
    payload.salesOrderId = childSalesOrderId;
    const created = await SalesOrderSection.create(payload);
    sectionMap.set(String(section._id), created._id);
  }

  return sectionMap;
}

function resolveMoveQty(line, requestedQty) {
  const openQty = openLineQuantity(line);
  if (openQty <= 0) {
    const err = new Error(`Line ${line.salesOrderLineId} has no open quantity to split.`);
    err.code = 'NOTHING_TO_SPLIT';
    throw err;
  }
  const moveQty = requestedQty == null ? openQty : Number(requestedQty);
  if (!Number.isFinite(moveQty) || moveQty <= 0 || moveQty > openQty) {
    const err = new Error('Split quantity exceeds open quantity.');
    err.code = 'VALIDATION';
    err.details = { openQty, quantity: moveQty };
    throw err;
  }
  return moveQty;
}

/**
 * @param {object} params
 */
async function splitSalesOrder({ organizationId, salesOrderRef, userId, body = {} }) {
  const parentOrder = await loadSalesOrderByRef({ organizationId, salesOrderRef });
  assertCanSplitOrder(parentOrder);

  const lineInputs = Array.isArray(body.lines) ? body.lines : [];
  if (!lineInputs.length) {
    const err = new Error('At least one line is required to split.');
    err.code = 'VALIDATION';
    throw err;
  }

  const parentLines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: parentOrder._id,
    hiddenLine: { $ne: true }
  }).sort({ lineOrder: 1, createdAt: 1 });

  const lineByPublicId = new Map(parentLines.map((row) => [String(row.salesOrderLineId), row]));
  const movePlans = [];

  for (const input of lineInputs) {
    const publicId = String(input?.salesOrderLineId || input?.lineId || '').trim();
    const line = lineByPublicId.get(publicId);
    if (!line) {
      const err = new Error(`Sales order line not found: ${publicId}`);
      err.code = 'LINE_NOT_FOUND';
      throw err;
    }
    const lineType = String(line.lineType || 'standard');
    if (lineType === 'bundle_component') {
      const err = new Error('Split bundle parent lines to move bundle groups.');
      err.code = 'SPLIT_AT_BUNDLE_PARENT';
      throw err;
    }

    const moveQty = resolveMoveQty(line, input.quantity);
    if (lineType === 'bundle_parent' && moveQty !== openLineQuantity(line)) {
      const err = new Error('Bundle lines must be split in full open quantity.');
      err.code = 'BUNDLE_SPLIT_WHOLE_ONLY';
      err.details = { salesOrderLineId: line.salesOrderLineId, openQty: openLineQuantity(line) };
      throw err;
    }

    movePlans.push({ line, moveQty });
  }

  const childOrder = await SalesOrder.create({
    organizationId,
    orderTitle: body.childOrderTitle ?? `${parentOrder.orderTitle || parentOrder.salesOrderNumber} (split)`,
    orderDate: parentOrder.orderDate,
    requestedDeliveryDate: parentOrder.requestedDeliveryDate,
    promisedDeliveryDate: parentOrder.promisedDeliveryDate,
    status: parentOrder.status,
    fulfillmentMode: parentOrder.fulfillmentMode,
    currency: parentOrder.currency,
    exchangeRateSnapshot: parentOrder.exchangeRateSnapshot,
    globalDiscountType: parentOrder.globalDiscountType,
    globalDiscountValue: parentOrder.globalDiscountValue,
    globalDiscountAmount: parentOrder.globalDiscountAmount,
    adjustmentTotal: parentOrder.adjustmentTotal,
    assignedTo: parentOrder.assignedTo,
    customerId: parentOrder.customerId,
    organizationRefId: parentOrder.organizationRefId,
    contactId: parentOrder.contactId,
    dealId: parentOrder.dealId,
    caseId: parentOrder.caseId,
    billToAddressSnapshot: parentOrder.billToAddressSnapshot,
    shipToAddressSnapshot: parentOrder.shipToAddressSnapshot,
    paymentTermsSnapshot: parentOrder.paymentTermsSnapshot,
    incotermsSnapshot: parentOrder.incotermsSnapshot,
    termsConditionsSnapshot: parentOrder.termsConditionsSnapshot,
    sourceType: 'split',
    sourceQuoteId: parentOrder.sourceQuoteId,
    sourceQuoteNumber: parentOrder.sourceQuoteNumber,
    sourceRevisionNumber: parentOrder.sourceRevisionNumber,
    quoteConversionLinkId: parentOrder.quoteConversionLinkId,
    conversionType: parentOrder.conversionType,
    lineageType: 'split_child',
    parentSalesOrderId: parentOrder._id,
    rootSalesOrderId: parentOrder.rootSalesOrderId || parentOrder._id,
    createdBy: userId ?? null,
    modifiedBy: userId ?? null,
    customFields: parentOrder.customFields || {}
  });

  const sectionMap = await cloneSectionsForChild({
    organizationId,
    parentSalesOrderId: parentOrder._id,
    childSalesOrderId: childOrder._id
  });

  const linesMoved = [];
  let childLineOrder = 1;

  for (const plan of movePlans) {
    const { line, moveQty } = plan;
    const lineType = String(line.lineType || 'standard');
    const childSectionId = line.salesOrderSectionId
      ? sectionMap.get(String(line.salesOrderSectionId)) || null
      : null;

    if (lineType === 'bundle_parent') {
      const childParent = await SalesOrderLine.create(
        buildChildLinePayload(line, {
          salesOrderId: childOrder._id,
          salesOrderSectionId: childSectionId,
          quantity: moveQty,
          parentBundleLineMongoId: null
        })
      );
      childParent.lineOrder = childLineOrder++;
      await childParent.save();

      const components = parentLines.filter(
        (row) => String(row.parentBundleLineId || '') === String(line._id)
      );
      for (const component of components) {
        const ratio = (Number(component.quantity) || 0) / (Number(line.quantity) || 1);
        const childComponentQty = ratio * moveQty;
        const childComponent = await SalesOrderLine.create(
          buildChildLinePayload(component, {
            salesOrderId: childOrder._id,
            salesOrderSectionId: childSectionId,
            quantity: childComponentQty,
            parentBundleLineMongoId: childParent._id
          })
        );
        childComponent.lineOrder = childLineOrder++;
        await childComponent.save();
        await SalesOrderLine.deleteOne({ _id: component._id, organizationId });
      }

      await SalesOrderLine.deleteOne({ _id: line._id, organizationId });
      linesMoved.push({
        salesOrderLineId: line.salesOrderLineId,
        quantityMoved: moveQty,
        childSalesOrderLineId: childParent.salesOrderLineId
      });
      continue;
    }

    const childLine = await SalesOrderLine.create(
      buildChildLinePayload(line, {
        salesOrderId: childOrder._id,
        salesOrderSectionId: childSectionId,
        quantity: moveQty,
        parentBundleLineMongoId: null
      })
    );
    childLine.lineOrder = childLineOrder++;
    await childLine.save();

    if (moveQty === openLineQuantity(line)) {
      await SalesOrderLine.deleteOne({ _id: line._id, organizationId });
    } else {
      line.quantity = (Number(line.quantity) || 0) - moveQty;
      recomputeLineTotals(line);
      await line.save();
    }

    linesMoved.push({
      salesOrderLineId: line.salesOrderLineId,
      quantityMoved: moveQty,
      childSalesOrderLineId: childLine.salesOrderLineId
    });
  }

  if (String(parentOrder.lineageType || 'standalone') === 'standalone') {
    parentOrder.lineageType = 'split_parent';
  }
  if (!parentOrder.rootSalesOrderId) {
    parentOrder.rootSalesOrderId = parentOrder._id;
  }
  parentOrder.modifiedBy = userId ?? null;
  await parentOrder.save();

  await recomputeSalesOrderAndSectionTotals({ organizationId, salesOrderId: parentOrder._id });
  await recomputeSalesOrderAndSectionTotals({ organizationId, salesOrderId: childOrder._id });

  const refreshedParent = await SalesOrder.findOne({ _id: parentOrder._id, organizationId }).lean();
  const refreshedChild = await SalesOrder.findOne({ _id: childOrder._id, organizationId }).lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: parentOrder._id,
    userId,
    action: 'sales_order_split',
    message: 'Sales order split',
    details: {
      parentSalesOrderId: parentOrder.salesOrderId,
      childSalesOrderId: childOrder.salesOrderId,
      childSalesOrderNumber: childOrder.salesOrderNumber,
      linesMoved
    }
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: childOrder._id,
    userId,
    action: 'sales_order_created',
    message: 'Created from split',
    details: {
      sourceType: 'split',
      parentSalesOrderId: parentOrder.salesOrderId,
      linesMoved
    }
  });

  return {
    parent: refreshedParent,
    child: refreshedChild,
    linesMoved
  };
}

module.exports = {
  openLineQuantity,
  assertCanSplitOrder,
  splitSalesOrder
};
