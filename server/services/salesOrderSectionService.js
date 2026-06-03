const SalesOrder = require('../models/SalesOrder');
const SalesOrderLine = require('../models/SalesOrderLine');
const SalesOrderSection = require('../models/SalesOrderSection');
const salesOrderTotalsService = require('./salesOrderTotalsService');
const { DEFAULT_SECTION_TITLE } = require('../constants/salesOrderSection');
const { isSalesOrderCommerciallyLockedStatus } = require('../constants/salesOrderLifecycle');
const { deriveHeaderFulfillmentStatus } = require('../constants/salesOrderFulfillment');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

const LINE_TOTALS_SELECT =
  '_id salesOrderLineId salesOrderSectionId lineType parentBundleLineId bundleSnapshot hiddenLine quantity unitPriceSnapshot lineSubtotal lineTaxTotal lineTotal discountType discountValue discountAmount quantityFulfilled quantityCancelled quantityBackordered fulfillmentStatus';

async function listSalesOrderSections({ organizationId, salesOrderId }) {
  return SalesOrderSection.find({ organizationId, salesOrderId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();
}

async function ensureDefaultSection({ organizationId, salesOrderId, lockedSnapshot = false }) {
  const existing = await SalesOrderSection.findOne({ organizationId, salesOrderId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();
  if (existing) return existing;

  return SalesOrderSection.create({
    organizationId,
    salesOrderId,
    sectionTitle: DEFAULT_SECTION_TITLE,
    sectionOrder: 0,
    lockedSnapshot
  }).then((doc) => doc.toObject());
}

async function resolveSectionForOrder({ organizationId, salesOrderId, sectionRef, orderStatus }) {
  if (!sectionRef) {
    return ensureDefaultSection({
      organizationId,
      salesOrderId,
      lockedSnapshot: isSalesOrderCommerciallyLockedStatus(orderStatus)
    });
  }

  const ref = String(sectionRef).trim();

  if (isMongoObjectIdString(ref)) {
    const byMongo = await SalesOrderSection.findOne({ organizationId, salesOrderId, _id: ref }).lean();
    if (byMongo) return byMongo;
  }

  const byPublicId = await SalesOrderSection.findOne({
    organizationId,
    salesOrderId,
    salesOrderSectionId: ref
  }).lean();
  if (byPublicId) return byPublicId;

  const err = new Error('Sales order section not found');
  err.code = 'SECTION_NOT_FOUND';
  throw err;
}

async function loadLinesForTotals({ organizationId, salesOrderId }) {
  return SalesOrderLine.find({ organizationId, salesOrderId, hiddenLine: { $ne: true } })
    .select(LINE_TOTALS_SELECT)
    .lean();
}

async function recomputeSalesOrderAndSectionTotals({ organizationId, salesOrderId }) {
  const order = await SalesOrder.findOne({ _id: salesOrderId, organizationId })
    .select(
      'globalDiscountType globalDiscountValue globalDiscountAmount adjustmentTotal status fulfillmentMode'
    )
    .lean();

  const orderDiscount = {
    globalDiscountType: order?.globalDiscountType,
    globalDiscountValue: order?.globalDiscountValue,
    globalDiscountAmount: order?.globalDiscountAmount,
    adjustmentTotal: order?.adjustmentTotal
  };

  const sections = await listSalesOrderSections({ organizationId, salesOrderId });
  const lines = await loadLinesForTotals({ organizationId, salesOrderId });

  let totals;
  let updatedSections = sections;

  if (!sections.length) {
    totals = salesOrderTotalsService.computeOrderTotalsFromLines(lines, orderDiscount);
    totals.sectionDiscountTotal = 0;
  } else {
    const result = salesOrderTotalsService.computeOrderTotalsWithSections(
      sections,
      lines,
      orderDiscount
    );
    totals = result.orderTotals;

    const bulkOps = result.sectionResults.map((row) => ({
      updateOne: {
        filter: { _id: row.sectionId, organizationId, salesOrderId },
        update: {
          $set: {
            sectionSubtotal: row.sectionSubtotal,
            sectionLineDiscountTotal: row.sectionLineDiscountTotal,
            sectionDiscountTotal: row.sectionDiscountTotal,
            sectionTaxTotal: row.sectionTaxTotal,
            sectionTotal: row.sectionTotal
          }
        }
      }
    }));

    if (bulkOps.length) {
      await SalesOrderSection.bulkWrite(bulkOps, { ordered: false });
      updatedSections = await listSalesOrderSections({ organizationId, salesOrderId });
    }
  }

  const fulfillmentStatus = deriveHeaderFulfillmentStatus(lines);
  const remainingBillableAmount = Math.max(
    0,
    (Number(totals.grandTotal) || 0) - (Number(order?.invoicedAmount) || 0)
  );

  await SalesOrder.updateOne(
    { _id: salesOrderId, organizationId },
    {
      $set: {
        ...totals,
        fulfillmentStatus,
        remainingBillableAmount
      }
    }
  );

  return { totals, sections: updatedSections, fulfillmentStatus };
}

async function assignLineToSection({ organizationId, salesOrderId, line, sectionRef, orderStatus }) {
  const section = await resolveSectionForOrder({
    organizationId,
    salesOrderId,
    sectionRef,
    orderStatus
  });
  line.salesOrderSectionId = section._id;
  return section;
}

async function moveBundleGroupToSection({ organizationId, salesOrderId, parentLine, sectionRef, orderStatus }) {
  const section = await resolveSectionForOrder({
    organizationId,
    salesOrderId,
    sectionRef,
    orderStatus
  });

  parentLine.salesOrderSectionId = section._id;
  await parentLine.save();

  await SalesOrderLine.updateMany(
    { organizationId, salesOrderId, parentBundleLineId: parentLine._id },
    { $set: { salesOrderSectionId: section._id } }
  );

  return section;
}

async function getNextSectionOrder({ organizationId, salesOrderId }) {
  const last = await SalesOrderSection.findOne({ organizationId, salesOrderId })
    .sort({ sectionOrder: -1, createdAt: -1 })
    .select('sectionOrder')
    .lean();
  const n = Number(last?.sectionOrder);
  return Number.isFinite(n) ? n + 1 : 0;
}

async function countLinesInSection({ organizationId, salesOrderId, sectionId }) {
  return SalesOrderLine.countDocuments({
    organizationId,
    salesOrderId,
    salesOrderSectionId: sectionId,
    hiddenLine: { $ne: true }
  });
}

module.exports = {
  listSalesOrderSections,
  ensureDefaultSection,
  resolveSectionForOrder,
  loadLinesForTotals,
  recomputeSalesOrderAndSectionTotals,
  assignLineToSection,
  moveBundleGroupToSection,
  getNextSectionOrder,
  countLinesInSection
};
