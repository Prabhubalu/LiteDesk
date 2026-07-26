/**
 * Draft commercial document ops shared patterns for Sales Orders (discounts, recalc, reorder).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const salesOrderTotalsService = require('./salesOrderTotalsService');
const {
  recomputeSalesOrderAndSectionTotals,
  listSalesOrderSections
} = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { SALES_ORDER_STATUS_DEFAULT } = require('../constants/salesOrderLifecycle');
const {
  applyGlobalDiscountFields,
  applySectionDiscountFields,
  normalizeLineReorderOpsOrThrow,
  normalizeSectionReorderOpsOrThrow
} = require('../utils/applyCommercialLineCommercialFields');

async function loadDraftSalesOrderDoc({ organizationId, salesOrderRef }) {
  const ref = String(salesOrderRef || '').trim();
  const order =
    (await SalesOrder.findOne({ organizationId, salesOrderId: ref, deletedAt: null })) ||
    (await SalesOrder.findOne({ organizationId, _id: ref, deletedAt: null }));

  if (!order) {
    const err = new Error('Sales order not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (String(order.status || '') !== SALES_ORDER_STATUS_DEFAULT) {
    const err = new Error('Commercial edits require Draft status.');
    err.code = 'SALES_ORDER_NOT_DRAFT';
    err.details = { status: order.status };
    throw err;
  }
  return order;
}

async function patchSalesOrderDiscounts({ organizationId, salesOrderRef, userId, body = {} }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  applyGlobalDiscountFields(order, body);
  await order.save();

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_discounts_updated',
    message: 'Sales order discounts updated',
    details: { totals }
  });

  const refreshed = await SalesOrder.findById(order._id).lean();
  return { quote: refreshed, salesOrder: refreshed, lines, sections, totals };
}

async function recalculateSalesOrder({ organizationId, salesOrderRef, userId }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id });

  for (const line of lines) {
    const computed = salesOrderTotalsService.computeLineTotals(line);
    line.lineSubtotal = computed.lineSubtotal;
    line.lineTaxTotal = computed.lineTaxTotal;
    line.lineTotal = computed.lineTotal;
    await line.save();
  }

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });
  const leanLines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_recalculated',
    message: 'Sales order totals recalculated',
    details: { totals, updatedLines: leanLines.length }
  });

  return {
    salesOrderId: order.salesOrderId,
    totals,
    sections,
    lines: leanLines,
    updatedLines: leanLines.length
  };
}

async function reorderSalesOrderLines({ organizationId, salesOrderRef, userId, orders }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const ops = normalizeLineReorderOpsOrThrow(orders, {
    lineIdField: 'salesOrderLineId',
    parentIdField: 'salesOrderId',
    parentId: order._id,
    organizationId
  });

  const result = await SalesOrderLine.bulkWrite(ops, { ordered: true });
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();
  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_lines_reordered',
    message: 'Lines reordered',
    details: { count: Array.isArray(orders) ? orders.length : 0, totals }
  });

  return {
    lines,
    totals,
    sections,
    bulk: { matched: result.matchedCount, modified: result.modifiedCount }
  };
}

async function reorderSalesOrderSections({ organizationId, salesOrderRef, userId, orders }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const ops = normalizeSectionReorderOpsOrThrow(orders, {
    sectionIdField: 'salesOrderSectionId',
    parentIdField: 'salesOrderId',
    parentId: order._id,
    organizationId
  });

  await SalesOrderSection.bulkWrite(ops, { ordered: false });
  const sections = await listSalesOrderSections({ organizationId, salesOrderId: order._id });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_sections_reordered',
    message: 'Sections reordered',
    details: { sectionCount: sections.length }
  });

  return { sections };
}

async function patchSalesOrderSectionDiscounts({
  organizationId,
  salesOrderRef,
  sectionId,
  userId,
  body = {}
}) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const ref = String(sectionId || '').trim();
  const section =
    (await SalesOrderSection.findOne({
      organizationId,
      salesOrderId: order._id,
      salesOrderSectionId: ref
    })) ||
    (await SalesOrderSection.findOne({ organizationId, salesOrderId: order._id, _id: ref }));

  if (!section) {
    const err = new Error('Sales order section not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  applySectionDiscountFields(section, body);
  await section.save();

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_section_discount_updated',
    message: `Section discount updated: ${section.sectionTitle}`,
    details: {
      salesOrderSectionId: section.salesOrderSectionId,
      sectionTitle: section.sectionTitle,
      totals
    }
  });

  return { section: section.toObject(), sections, totals };
}

async function patchSalesOrderTaxesCharges({ organizationId, salesOrderRef, userId, body = {} }) {
  const order = await loadDraftSalesOrderDoc({ organizationId, salesOrderRef });
  const { applyDocumentTaxesChargesSnapshots } = require('../utils/applyDocumentTaxesCharges');
  await applyDocumentTaxesChargesSnapshots(order, body, {
    organizationId,
    LineModel: SalesOrderLine,
    parentIdField: 'salesOrderId'
  });
  await order.save();

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });
  const lines = await SalesOrderLine.find({ organizationId, salesOrderId: order._id })
    .sort({ lineOrder: 1, createdAt: 1 })
    .lean();
  const refreshed = await SalesOrder.findById(order._id).lean();

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_taxes_charges_updated',
    message: 'Sales order taxes/charges updated',
    details: { totals }
  });

  return { quote: refreshed, salesOrder: refreshed, lines, sections, totals };
}

module.exports = {
  patchSalesOrderDiscounts,
  recalculateSalesOrder,
  reorderSalesOrderLines,
  reorderSalesOrderSections,
  patchSalesOrderSectionDiscounts,
  patchSalesOrderTaxesCharges,
  loadDraftSalesOrderDoc
};
