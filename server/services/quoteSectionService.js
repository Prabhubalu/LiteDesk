const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteSection = require('../models/QuoteSection');
const quoteTotalsService = require('./quoteTotalsService');
const { DEFAULT_SECTION_TITLE } = require('../constants/quoteSection');
const { isCommerciallyLockedStatus } = require('../constants/quoteLifecycle');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

const LINE_TOTALS_SELECT =
  '_id quoteLineId quoteSectionId lineType parentBundleLineId bundleSnapshot hiddenLine quantity unitPriceSnapshot lineSubtotal lineTaxTotal lineTotal discountType discountValue discountAmount taxSnapshot chargeSnapshot';

async function listQuoteSections({ organizationId, quoteId }) {
  return QuoteSection.find({ organizationId, quoteId }).sort({ sectionOrder: 1, createdAt: 1 }).lean();
}

async function ensureDefaultSection({ organizationId, quoteId, lockedSnapshot = false }) {
  const existing = await QuoteSection.findOne({ organizationId, quoteId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();
  if (existing) return existing;

  return QuoteSection.create({
    organizationId,
    quoteId,
    sectionTitle: DEFAULT_SECTION_TITLE,
    sectionOrder: 0,
    lockedSnapshot
  }).then((doc) => doc.toObject());
}

async function resolveSectionForQuote({ organizationId, quoteId, sectionRef, quoteStatus }) {
  if (!sectionRef) {
    return ensureDefaultSection({
      organizationId,
      quoteId,
      lockedSnapshot: isCommerciallyLockedStatus(quoteStatus)
    });
  }

  const ref = String(sectionRef).trim();

  if (isMongoObjectIdString(ref)) {
    const byMongo = await QuoteSection.findOne({ organizationId, quoteId, _id: ref }).lean();
    if (byMongo) return byMongo;
  }

  const byPublicId = await QuoteSection.findOne({ organizationId, quoteId, quoteSectionId: ref }).lean();
  if (byPublicId) return byPublicId;

  const err = new Error('Quote section not found');
  err.code = 'SECTION_NOT_FOUND';
  throw err;
}

async function getNextSectionOrder({ organizationId, quoteId }) {
  const last = await QuoteSection.findOne({ organizationId, quoteId })
    .sort({ sectionOrder: -1, createdAt: -1 })
    .select('sectionOrder')
    .lean();
  const n = Number(last?.sectionOrder);
  return Number.isFinite(n) ? n + 1 : 1;
}

async function loadLinesForTotals({ organizationId, quoteId }) {
  return QuoteLine.find({ organizationId, quoteId, hiddenLine: { $ne: true } })
    .select(LINE_TOTALS_SELECT)
    .lean();
}

async function recomputeQuoteAndSectionTotals({ organizationId, quoteId }) {
  const quote = await Quote.findOne({ _id: quoteId, organizationId })
    .select(
      'globalDiscountType globalDiscountValue globalDiscountAmount adjustmentTotal status chargesTotal transactionTaxSnapshot'
    )
    .lean();

  const quoteDiscount = {
    globalDiscountType: quote?.globalDiscountType,
    globalDiscountValue: quote?.globalDiscountValue,
    globalDiscountAmount: quote?.globalDiscountAmount,
    adjustmentTotal: quote?.adjustmentTotal
  };

  const sections = await listQuoteSections({ organizationId, quoteId });
  let lines = await loadLinesForTotals({ organizationId, quoteId });

  // Re-apply tax engine per line so lineTaxTotal stays consistent with snapshots
  const {
    applyTaxesToLine,
    taxesFromSnapshot,
    recalculateDocumentMoney
  } = require('./commercialTaxApplicationService');

  const lineBulkOps = [];
  const refreshedLines = [];
  for (const line of lines) {
    const taxes = taxesFromSnapshot(line.taxSnapshot);
    // Without snapshot taxes, keep stored money — do not re-apply with [].
    if (!taxes.length) {
      refreshedLines.push(line);
      continue;
    }
    const applied = applyTaxesToLine(line, taxes);
    refreshedLines.push({
      ...line,
      lineSubtotal: applied.lineSubtotal,
      lineTaxTotal: applied.lineTaxTotal,
      lineTotal: applied.lineTotal,
      taxSnapshot: applied.taxSnapshot
    });
    if (line._id) {
      lineBulkOps.push({
        updateOne: {
          filter: { _id: line._id, organizationId, quoteId },
          update: {
            $set: {
              lineSubtotal: applied.lineSubtotal,
              lineTaxTotal: applied.lineTaxTotal,
              lineTotal: applied.lineTotal,
              taxSnapshot: applied.taxSnapshot
            }
          }
        }
      });
    }
  }
  if (lineBulkOps.length) {
    await QuoteLine.bulkWrite(lineBulkOps, { ordered: false });
  }
  lines = refreshedLines;

  const txnTaxes = Array.isArray(quote?.transactionTaxSnapshot?.taxes)
    ? quote.transactionTaxSnapshot.taxes
    : [];
  const money = recalculateDocumentMoney({
    lines,
    transactionTaxes: txnTaxes,
    chargesTotal: Number(quote?.chargesTotal) || 0,
    globalDiscountType: quoteDiscount.globalDiscountType,
    globalDiscountValue: quoteDiscount.globalDiscountValue,
    globalDiscountAmount: quoteDiscount.globalDiscountAmount,
    adjustmentTotal: quoteDiscount.adjustmentTotal
  });

  let totals;
  let updatedSections = sections;

  if (!sections.length) {
    totals = {
      ...quoteTotalsService.computeQuoteTotalsFromLines(lines, quoteDiscount),
      taxTotal: money.totals.taxTotal,
      chargesTotal: money.totals.chargesTotal,
      grandTotal: money.totals.grandTotal,
      taxDocumentSnapshot: money.taxDocumentSnapshot
    };
    // Prefer engine grand total which includes charges + txn taxes
    totals.grandTotal = money.totals.grandTotal;
    totals.taxTotal = money.totals.taxTotal;
  } else {
    const result = quoteTotalsService.computeQuoteTotalsWithSections(sections, lines, quoteDiscount);
    totals = {
      ...result.quoteTotals,
      taxTotal: money.totals.taxTotal,
      chargesTotal: money.totals.chargesTotal,
      grandTotal: money.totals.grandTotal,
      taxDocumentSnapshot: money.taxDocumentSnapshot
    };

    const bulkOps = result.sectionResults.map((row) => ({
      updateOne: {
        filter: { _id: row.sectionId, organizationId, quoteId },
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
      await QuoteSection.bulkWrite(bulkOps, { ordered: false });
      updatedSections = await listQuoteSections({ organizationId, quoteId });
    }
  }

  await Quote.updateOne(
    { _id: quoteId, organizationId },
    {
      $set: {
        subtotal: totals.subtotal,
        lineDiscountTotal: totals.lineDiscountTotal,
        globalDiscountTotal: totals.globalDiscountTotal,
        taxTotal: totals.taxTotal,
        chargesTotal: totals.chargesTotal ?? 0,
        adjustmentTotal: totals.adjustmentTotal,
        grandTotal: totals.grandTotal,
        taxDocumentSnapshot: totals.taxDocumentSnapshot || {}
      }
    }
  );

  return { totals, sections: updatedSections };
}

/** @deprecated alias — use recomputeQuoteAndSectionTotals */
async function recomputeQuoteSimpleTotals({ organizationId, quoteId }) {
  const { totals } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId });
  return totals;
}

async function findOrCreateSectionByTitle({ organizationId, quoteId, title, quoteStatus }) {
  const sectionTitle = String(title || '').trim();
  if (!sectionTitle) {
    return ensureDefaultSection({ organizationId, quoteId, lockedSnapshot: isCommerciallyLockedStatus(quoteStatus) });
  }

  const existing = await QuoteSection.findOne({ organizationId, quoteId, sectionTitle }).lean();
  if (existing) return existing;

  const sectionOrder = await getNextSectionOrder({ organizationId, quoteId });
  return QuoteSection.create({
    organizationId,
    quoteId,
    sectionTitle,
    sectionOrder,
    lockedSnapshot: isCommerciallyLockedStatus(quoteStatus)
  }).then((doc) => doc.toObject());
}

async function assignLineToSection({ organizationId, quoteId, line, quoteSectionId, quoteStatus }) {
  const section = await resolveSectionForQuote({
    organizationId,
    quoteId,
    sectionRef: quoteSectionId,
    quoteStatus
  });
  line.quoteSectionId = section._id;
  return section;
}

async function moveBundleGroupToSection({ organizationId, quoteId, parentLine, quoteSectionId }) {
  const section = await resolveSectionForQuote({
    organizationId,
    quoteId,
    sectionRef: quoteSectionId,
    quoteStatus: null
  });

  parentLine.quoteSectionId = section._id;
  await parentLine.save();

  await QuoteLine.updateMany(
    { organizationId, quoteId, parentBundleLineId: parentLine._id },
    { $set: { quoteSectionId: section._id } }
  );

  return section;
}

async function countLinesInSection({ organizationId, quoteId, sectionId }) {
  return QuoteLine.countDocuments({ organizationId, quoteId, quoteSectionId: sectionId });
}

/**
 * Clone sections for a new revision; returns oldMongoId → newMongoId map.
 */
function buildSectionClonePayloads(sourceSections, targetQuoteId) {
  return sourceSections.map((section) => {
    const payload = { ...section };
    delete payload._id;
    delete payload.quoteSectionId;
    delete payload.createdAt;
    delete payload.updatedAt;
    payload.quoteId = targetQuoteId;
    payload.lockedSnapshot = false;
    return payload;
  });
}

function mapClonedSectionIds(sourceSections, createdSections) {
  const oldToNewSectionId = new Map();
  for (let i = 0; i < sourceSections.length; i++) {
    oldToNewSectionId.set(String(sourceSections[i]._id), createdSections[i]._id);
  }
  return oldToNewSectionId;
}

async function cloneSectionsForRevision({ organizationId, sourceQuoteId, targetQuoteId }) {
  const sourceSections = await QuoteSection.find({ organizationId, quoteId: sourceQuoteId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  if (!sourceSections.length) {
    return { oldToNewSectionId: new Map(), sections: [] };
  }

  const payloads = buildSectionClonePayloads(sourceSections, targetQuoteId);
  const created = await QuoteSection.insertMany(payloads, { ordered: true });
  const oldToNewSectionId = mapClonedSectionIds(sourceSections, created);

  return { oldToNewSectionId, sections: created };
}

module.exports = {
  listQuoteSections,
  ensureDefaultSection,
  resolveSectionForQuote,
  getNextSectionOrder,
  loadLinesForTotals,
  recomputeQuoteAndSectionTotals,
  recomputeQuoteSimpleTotals,
  assignLineToSection,
  moveBundleGroupToSection,
  countLinesInSection,
  cloneSectionsForRevision,
  buildSectionClonePayloads,
  mapClonedSectionIds,
  findOrCreateSectionByTitle
};
