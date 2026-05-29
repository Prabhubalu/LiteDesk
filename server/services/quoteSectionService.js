const Quote = require('../models/Quote');
const QuoteLine = require('../models/QuoteLine');
const QuoteSection = require('../models/QuoteSection');
const quoteTotalsService = require('./quoteTotalsService');
const { DEFAULT_SECTION_TITLE } = require('../constants/quoteSection');
const { isCommerciallyLockedStatus } = require('../constants/quoteLifecycle');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

const LINE_TOTALS_SELECT =
  '_id quoteLineId quoteSectionId lineType parentBundleLineId bundleSnapshot hiddenLine quantity unitPriceSnapshot lineSubtotal lineTaxTotal lineTotal discountType discountValue discountAmount';

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
    .select('globalDiscountType globalDiscountValue globalDiscountAmount adjustmentTotal status')
    .lean();

  const quoteDiscount = {
    globalDiscountType: quote?.globalDiscountType,
    globalDiscountValue: quote?.globalDiscountValue,
    globalDiscountAmount: quote?.globalDiscountAmount,
    adjustmentTotal: quote?.adjustmentTotal
  };

  const sections = await listQuoteSections({ organizationId, quoteId });
  const lines = await loadLinesForTotals({ organizationId, quoteId });

  let totals;
  let updatedSections = sections;

  if (!sections.length) {
    totals = quoteTotalsService.computeQuoteTotalsFromLines(lines, quoteDiscount);
  } else {
    const result = quoteTotalsService.computeQuoteTotalsWithSections(sections, lines, quoteDiscount);
    totals = result.quoteTotals;

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

  await Quote.updateOne({ _id: quoteId, organizationId }, { $set: totals });

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
async function cloneSectionsForRevision({ organizationId, sourceQuoteId, targetQuoteId }) {
  const sourceSections = await QuoteSection.find({ organizationId, quoteId: sourceQuoteId })
    .sort({ sectionOrder: 1, createdAt: 1 })
    .lean();

  if (!sourceSections.length) {
    return { oldToNewSectionId: new Map(), sections: [] };
  }

  const oldToNewSectionId = new Map();
  const payloads = sourceSections.map((section) => {
    const payload = { ...section };
    delete payload._id;
    delete payload.quoteSectionId;
    delete payload.createdAt;
    delete payload.updatedAt;
    payload.quoteId = targetQuoteId;
    payload.lockedSnapshot = false;
    return payload;
  });

  const created = await QuoteSection.insertMany(payloads, { ordered: true });
  for (let i = 0; i < sourceSections.length; i++) {
    oldToNewSectionId.set(String(sourceSections[i]._id), created[i]._id);
  }

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
  findOrCreateSectionByTitle
};
