/**
 * Draft sales order line mutations (edit qty, move section, delete).
 */

const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const salesOrderTotalsService = require('./salesOrderTotalsService');
const {
  recomputeSalesOrderAndSectionTotals,
  assignLineToSection,
  moveBundleGroupToSection
} = require('./salesOrderSectionService');
const { writeSalesOrderActivity } = require('./salesOrderActivityService');
const { SALES_ORDER_STATUS_DEFAULT } = require('../constants/salesOrderLifecycle');
const { guardSalesOrderLineQuantity } = require('./inventoryAtpGuardService');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function loadDraftSalesOrder({ organizationId, salesOrderRef }) {
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
    const err = new Error('Lines can only be edited while sales order is Draft.');
    err.code = 'SALES_ORDER_NOT_DRAFT';
    err.details = { status: order.status };
    throw err;
  }

  return order;
}

async function loadDraftLine({ organizationId, salesOrderId, lineRef }) {
  const ref = String(lineRef || '').trim();
  const line =
    (await SalesOrderLine.findOne({ organizationId, salesOrderId, salesOrderLineId: ref })) ||
    (await SalesOrderLine.findOne({ organizationId, salesOrderId, _id: ref }));

  if (!line) {
    const err = new Error('Sales order line not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return line;
}

function recomputeLineTotals(line) {
  const computed = salesOrderTotalsService.computeLineTotals(line);
  line.lineSubtotal = computed.lineSubtotal;
  line.lineTaxTotal = computed.lineTaxTotal;
  line.lineTotal = computed.lineTotal;
}

async function scaleBundleComponentsForParentQty({
  organizationId,
  salesOrderId,
  parentLine,
  oldParentQty,
  newParentQty
}) {
  const components = await SalesOrderLine.find({
    organizationId,
    salesOrderId,
    parentBundleLineId: parentLine._id
  });

  const compDefs = Array.isArray(parentLine.bundleSnapshot?.components)
    ? parentLine.bundleSnapshot.components
    : [];
  const safeOld = Number(oldParentQty) > 0 ? Number(oldParentQty) : 1;

  for (const child of components) {
    if (child.hiddenLine === true) continue;

    const compDef = compDefs.find(
      (row) => String(row.componentVariantId) === String(child.variantId)
    );
    const perBundle = compDef
      ? Number(compDef.quantity) || 0
      : (Number(child.quantity) || 0) / safeOld;
    child.quantity = perBundle * newParentQty;
    recomputeLineTotals(child);
    await child.save();
  }
}

async function sectionSnapshotForActivity({ organizationId, salesOrderId, sectionId }) {
  if (!sectionId) return { id: null, title: null };
  const section = await SalesOrderSection.findOne({ organizationId, salesOrderId, _id: sectionId })
    .select('sectionTitle salesOrderSectionId')
    .lean();
  if (!section) return { id: String(sectionId), title: null };
  return {
    id: section.salesOrderSectionId || String(section._id),
    title: section.sectionTitle || null
  };
}

/**
 * PATCH draft line — quantity and/or section move (bundle-safe).
 */
async function patchSalesOrderLine({
  organizationId,
  salesOrderRef,
  lineRef,
  userId,
  body = {}
}) {
  const order = await loadDraftSalesOrder({ organizationId, salesOrderRef });
  const line = await loadDraftLine({ organizationId, salesOrderId: order._id, lineRef });

  const lineType = String(line.lineType || 'standard');
  if (lineType === 'bundle_component') {
    const err = new Error('Edit the bundle parent to change quantity or section.');
    err.code = 'BUNDLE_EDIT_AT_PARENT';
    throw err;
  }

  const previousSectionId = line.salesOrderSectionId ? String(line.salesOrderSectionId) : null;
  let sectionAssignmentRequested = false;
  let quantityChanged = false;

  if (body.quantity !== undefined) {
    const quantity = asNumber(body.quantity, { defaultValue: NaN });
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error('quantity must be > 0');
      err.code = 'VALIDATION';
      throw err;
    }

    const oldQty = Number(line.quantity) || 0;
    if (String(lineType) !== 'bundle_parent') {
      await guardSalesOrderLineQuantity({
        organizationId,
        order,
        variantId: line.variantId,
        quantity,
        userId,
        forceProceed: body?.forceAtpProceed === true,
        excludeSalesOrderLineId: line.salesOrderLineId
      });
    }

    line.quantity = quantity;
    quantityChanged = oldQty !== quantity;

    if (lineType === 'bundle_parent' && quantityChanged) {
      await scaleBundleComponentsForParentQty({
        organizationId,
        salesOrderId: order._id,
        parentLine: line,
        oldParentQty: oldQty,
        newParentQty: quantity
      });
    }
  }

  if (body.salesOrderSectionId !== undefined) {
    sectionAssignmentRequested = true;
    if (lineType === 'bundle_parent') {
      await moveBundleGroupToSection({
        organizationId,
        salesOrderId: order._id,
        parentLine: line,
        sectionRef: body.salesOrderSectionId,
        orderStatus: order.status
      });
    } else {
      await assignLineToSection({
        organizationId,
        salesOrderId: order._id,
        line,
        sectionRef: body.salesOrderSectionId,
        orderStatus: order.status
      });
    }
  }

  recomputeLineTotals(line);
  await line.save();

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  const newSectionId = line.salesOrderSectionId ? String(line.salesOrderSectionId) : null;
  const sectionChanged = sectionAssignmentRequested && previousSectionId !== newSectionId;

  if (sectionChanged) {
    const [fromSection, toSection] = await Promise.all([
      sectionSnapshotForActivity({ organizationId, salesOrderId: order._id, sectionId: previousSectionId }),
      sectionSnapshotForActivity({ organizationId, salesOrderId: order._id, sectionId: newSectionId })
    ]);
    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId,
      action: 'sales_order_line_section_moved',
      message: toSection.title
        ? `Moved line to section: ${toSection.title}`
        : 'Moved line to another section',
      details: {
        salesOrderLineId: line.salesOrderLineId,
        fromSectionId: fromSection.id,
        fromSectionTitle: fromSection.title,
        toSectionId: toSection.id,
        toSectionTitle: toSection.title,
        totals
      }
    });
  }

  if (quantityChanged || (body.quantity !== undefined && !sectionChanged)) {
    await writeSalesOrderActivity({
      organizationId,
      salesOrderId: order._id,
      userId,
      action: 'sales_order_line_updated',
      message: 'Line updated',
      details: {
        salesOrderLineId: line.salesOrderLineId,
        quantity: line.quantity,
        totals
      }
    });
  }

  return { line: line.toObject(), totals, sections };
}

/**
 * DELETE draft line — cascade bundle components when parent removed.
 */
async function deleteSalesOrderLine({ organizationId, salesOrderRef, lineRef, userId }) {
  const order = await loadDraftSalesOrder({ organizationId, salesOrderRef });
  const line = await loadDraftLine({ organizationId, salesOrderId: order._id, lineRef });

  const lineType = String(line.lineType || 'standard');
  if (lineType === 'bundle_component') {
    const err = new Error('Remove the bundle parent to delete all bundle lines.');
    err.code = 'BUNDLE_DELETE_AT_PARENT';
    throw err;
  }

  const deleted = await SalesOrderLine.findOneAndDelete({
    organizationId,
    salesOrderId: order._id,
    _id: line._id
  }).lean();

  if (!deleted) {
    const err = new Error('Sales order line not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (lineType === 'bundle_parent') {
    await SalesOrderLine.deleteMany({
      organizationId,
      salesOrderId: order._id,
      parentBundleLineId: deleted._id
    });
  }

  const { totals, sections } = await recomputeSalesOrderAndSectionTotals({
    organizationId,
    salesOrderId: order._id
  });

  await writeSalesOrderActivity({
    organizationId,
    salesOrderId: order._id,
    userId,
    action: 'sales_order_line_deleted',
    message: 'Line removed',
    details: { salesOrderLineId: deleted.salesOrderLineId, totals }
  });

  return { deleted, totals, sections };
}

module.exports = {
  patchSalesOrderLine,
  deleteSalesOrderLine,
  scaleBundleComponentsForParentQty
};
