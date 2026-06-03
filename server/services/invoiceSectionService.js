const Invoice = require('../models/Invoice');
const InvoiceLine = require('../models/InvoiceLine');
const InvoiceSection = require('../models/InvoiceSection');
const invoiceTotalsService = require('./invoiceTotalsService');
const { DEFAULT_INVOICE_SECTION_TITLE } = require('../constants/invoiceSection');

const LINE_TOTALS_SELECT =
  '_id invoiceLineId invoiceSectionId lineType parentBundleLineId bundleSnapshot hiddenLine quantity unitPriceSnapshot lineSubtotal lineTaxTotal lineTotal discountType discountValue discountAmount taxSnapshot';

async function listInvoiceSections({ organizationId, invoiceId }) {
  return InvoiceSection.find({ organizationId, invoiceId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();
}

async function ensureDefaultInvoiceSection({ organizationId, invoiceId }) {
  const existing = await InvoiceSection.findOne({ organizationId, invoiceId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();
  if (existing) return existing;

  return InvoiceSection.create({
    organizationId,
    invoiceId,
    sectionTitle: DEFAULT_INVOICE_SECTION_TITLE,
    sectionOrder: 0
  }).then((doc) => doc.toObject());
}

async function loadLinesForTotals({ organizationId, invoiceId }) {
  return InvoiceLine.find({ organizationId, invoiceId, hiddenLine: { $ne: true } })
    .select(LINE_TOTALS_SELECT)
    .lean();
}

async function recomputeInvoiceAndSectionTotals({ organizationId, invoiceId }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, organizationId })
    .select('globalDiscountType globalDiscountValue globalDiscountAmount adjustmentTotal status')
    .lean();

  const invoiceDiscount = {
    globalDiscountType: invoice?.globalDiscountType,
    globalDiscountValue: invoice?.globalDiscountValue,
    globalDiscountAmount: invoice?.globalDiscountAmount,
    adjustmentTotal: invoice?.adjustmentTotal
  };

  const sections = await listInvoiceSections({ organizationId, invoiceId });
  const lines = await loadLinesForTotals({ organizationId, invoiceId });

  let totals;
  let updatedSections = sections;

  if (!sections.length) {
    totals = invoiceTotalsService.computeInvoiceTotalsFromLines(lines, invoiceDiscount);
    totals.sectionDiscountTotal = 0;
  } else {
    const result = invoiceTotalsService.computeInvoiceTotalsWithSections(
      sections,
      lines,
      invoiceDiscount
    );
    totals = result.invoiceTotals;

    const bulkOps = result.sectionResults.map((row) => ({
      updateOne: {
        filter: { _id: row.sectionId, organizationId, invoiceId },
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
      await InvoiceSection.bulkWrite(bulkOps, { ordered: false });
      updatedSections = await listInvoiceSections({ organizationId, invoiceId });
    }
  }

  await Invoice.updateOne(
    { _id: invoiceId, organizationId },
    {
      $set: {
        subtotal: totals.subtotal || 0,
        lineDiscountTotal: totals.lineDiscountTotal || 0,
        sectionDiscountTotal: totals.sectionDiscountTotal || 0,
        globalDiscountTotal: totals.globalDiscountTotal || 0,
        taxTotal: totals.taxTotal || 0,
        adjustmentTotal: totals.adjustmentTotal || 0,
        grandTotal: totals.grandTotal || 0
      }
    }
  );

  return { totals, sections: updatedSections };
}

async function getNextSectionOrder({ organizationId, invoiceId }) {
  const last = await InvoiceSection.findOne({ organizationId, invoiceId })
    .sort({ sectionOrder: -1, createdAt: -1 })
    .select('sectionOrder')
    .lean();
  const n = Number(last?.sectionOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

async function countLinesInSection({ organizationId, invoiceId, sectionId }) {
  return InvoiceLine.countDocuments({
    organizationId,
    invoiceId,
    invoiceSectionId: sectionId
  });
}

module.exports = {
  listInvoiceSections,
  ensureDefaultInvoiceSection,
  recomputeInvoiceAndSectionTotals,
  getNextSectionOrder,
  countLinesInSection
};
