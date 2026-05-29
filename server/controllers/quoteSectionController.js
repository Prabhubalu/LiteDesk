const Quote = require('../models/Quote');
const QuoteSection = require('../models/QuoteSection');
const { assertValidSectionType } = require('../constants/quoteSection');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');
const { writeQuoteActivity } = require('../services/quoteActivityService');
const {
  listQuoteSections,
  getNextSectionOrder,
  recomputeQuoteAndSectionTotals,
  countLinesInSection
} = require('../services/quoteSectionService');
const {
  assertQuoteCommerciallyEditableForLineWrite,
  userCanOverridePricing
} = require('./quoteLineController');
const { isCommerciallyLockedStatus, assertQuoteRecordEditable } = require('../constants/quoteLifecycle');

function asNumber(value, { defaultValue = NaN } = {}) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

function assertQuoteEditableForSectionWrite({ quote, overridePricing, req }) {
  assertQuoteRecordEditable({ status: quote.status });
  if (quote.approvalLocked === true) {
    const err = new Error('Quote is approval-locked');
    err.code = 'APPROVAL_LOCKED';
    throw err;
  }
  assertQuoteCommerciallyEditableForLineWrite({
    quoteStatus: quote.status,
    overridePricing,
    req
  });
}

async function findSectionOrThrow({ organizationId, quoteId, sectionId }) {
  const ref = String(sectionId || '').trim();
  let section = null;
  if (isMongoObjectIdString(ref)) {
    section = await QuoteSection.findOne({ organizationId, quoteId, _id: ref });
  }
  if (!section) {
    section = await QuoteSection.findOne({ organizationId, quoteId, quoteSectionId: ref });
  }
  if (!section) {
    const err = new Error('Quote section not found');
    err.code = 'SECTION_NOT_FOUND';
    throw err;
  }
  return section;
}

/**
 * GET /api/quotes/:id/sections
 */
async function listSections(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId }).select('_id').lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const sections = await listQuoteSections({ organizationId, quoteId });
    return res.json({ success: true, data: sections });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to list quote sections',
      code: err?.code || 'UNKNOWN'
    });
  }
}

/**
 * POST /api/quotes/:id/sections
 * Body: { sectionTitle, sectionDescription?, sectionType?, includeInQuoteTotal?, sectionOrder? }
 */
async function createSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteEditableForSectionWrite({ quote, overridePricing: override, req });

    const sectionTitle = String(req.body?.sectionTitle || '').trim();
    if (!sectionTitle) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle is required' });
    }

    let sectionType;
    try {
      sectionType = assertValidSectionType(req.body?.sectionType);
    } catch (e) {
      return res.status(400).json({ success: false, code: e.code || 'VALIDATION', message: e.message });
    }

    const sectionOrder =
      req.body?.sectionOrder !== undefined
        ? asNumber(req.body.sectionOrder, { defaultValue: NaN })
        : await getNextSectionOrder({ organizationId, quoteId });

    if (!Number.isFinite(sectionOrder)) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionOrder must be a number' });
    }

    const includeInQuoteTotal =
      req.body?.includeInQuoteTotal !== undefined ? req.body.includeInQuoteTotal === true : sectionType !== 'optional';

    const section = await QuoteSection.create({
      organizationId,
      quoteId: quote._id,
      sectionTitle,
      sectionDescription: req.body?.sectionDescription ?? null,
      sectionOrder,
      sectionType,
      includeInQuoteTotal,
      showSectionTotal: req.body?.showSectionTotal !== false,
      pageBreakBefore: req.body?.pageBreakBefore === true,
      hiddenSection: req.body?.hiddenSection === true,
      lockedSnapshot: isCommerciallyLockedStatus(quote.status)
    });

    const { totals } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_section_created',
      message: `Section created: ${sectionTitle}`,
      details: { quoteSectionId: section.quoteSectionId, sectionTitle, totals }
    });

    return res.status(201).json({ success: true, data: { section, totals } });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' || err?.code === 'APPROVAL_LOCKED' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to create quote section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * PATCH /api/quotes/:id/sections/:sectionId
 */
async function patchSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteEditableForSectionWrite({ quote, overridePricing: override, req });

    const section = await findSectionOrThrow({ organizationId, quoteId, sectionId: req.params.sectionId });

    if (req.body?.sectionTitle !== undefined) {
      const title = String(req.body.sectionTitle || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionTitle cannot be empty' });
      }
      section.sectionTitle = title;
    }
    if (req.body?.sectionDescription !== undefined) {
      section.sectionDescription = req.body.sectionDescription ?? null;
    }
    if (req.body?.sectionType !== undefined) {
      section.sectionType = assertValidSectionType(req.body.sectionType);
    }
    if (req.body?.includeInQuoteTotal !== undefined) {
      section.includeInQuoteTotal = req.body.includeInQuoteTotal === true;
    }
    if (req.body?.showSectionTotal !== undefined) {
      section.showSectionTotal = req.body.showSectionTotal !== false;
    }
    if (req.body?.pageBreakBefore !== undefined) {
      section.pageBreakBefore = req.body.pageBreakBefore === true;
    }
    if (req.body?.hiddenSection !== undefined) {
      section.hiddenSection = req.body.hiddenSection === true;
    }
    if (req.body?.sectionOrder !== undefined) {
      const order = asNumber(req.body.sectionOrder, { defaultValue: NaN });
      if (!Number.isFinite(order)) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionOrder must be a number' });
      }
      section.sectionOrder = order;
    }

    section.lockedSnapshot = section.lockedSnapshot || isCommerciallyLockedStatus(quote.status);
    await section.save();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_section_updated',
      message: `Section updated: ${section.sectionTitle}`,
      details: { quoteSectionId: section.quoteSectionId, totals }
    });

    return res.json({
      success: true,
      data: { section, sections, totals }
    });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'APPROVAL_LOCKED' ||
      err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ||
      err?.code === 'SECTION_NOT_FOUND'
        ? err?.code === 'SECTION_NOT_FOUND'
          ? 404
          : 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update quote section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * PATCH /api/quotes/:id/sections/:sectionId/discounts
 */
async function patchSectionDiscounts(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteEditableForSectionWrite({ quote, overridePricing: override, req });

    const section = await findSectionOrThrow({ organizationId, quoteId, sectionId: req.params.sectionId });

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionDiscountType')) {
      const raw = req.body.sectionDiscountType;
      section.sectionDiscountType = raw === null || raw === '' ? null : String(raw).trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionDiscountValue')) {
      const v = asNumber(req.body.sectionDiscountValue, { defaultValue: NaN });
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionDiscountValue must be >= 0' });
      }
      section.sectionDiscountValue = v;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionDiscountAmount')) {
      const a = asNumber(req.body.sectionDiscountAmount, { defaultValue: NaN });
      if (!Number.isFinite(a) || a < 0) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionDiscountAmount must be >= 0' });
      }
      section.sectionDiscountAmount = a;
    } else if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionDiscountType') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'sectionDiscountValue')
    ) {
      section.sectionDiscountAmount = 0;
    }

    section.lockedSnapshot = section.lockedSnapshot || isCommerciallyLockedStatus(quote.status);
    await section.save();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_section_discount_updated',
      message: `Section discount updated: ${section.sectionTitle}`,
      details: { quoteSectionId: section.quoteSectionId, totals }
    });

    return res.json({ success: true, data: { section, sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'APPROVAL_LOCKED' ||
      err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ||
      err?.code === 'SECTION_NOT_FOUND'
        ? err?.code === 'SECTION_NOT_FOUND'
          ? 404
          : 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to update section discounts',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * PATCH /api/quotes/:id/sections/reorder
 * Body: { orders: [{ quoteSectionId, sectionOrder }] }
 */
async function reorderSections(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;
    const orders = req.body?.orders;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteEditableForSectionWrite({ quote, overridePricing: override, req });

    if (!Array.isArray(orders) || !orders.length) {
      return res.status(400).json({ success: false, code: 'VALIDATION', message: 'orders[] is required' });
    }

    const bulkOps = [];
    const seen = new Set();
    for (const row of orders) {
      const id = row?.quoteSectionId;
      if (!id) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'Each order row requires quoteSectionId' });
      }
      if (seen.has(id)) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'Duplicate quoteSectionId in orders[]' });
      }
      seen.add(id);

      const order = asNumber(row?.sectionOrder, { defaultValue: NaN });
      if (!Number.isFinite(order)) {
        return res.status(400).json({ success: false, code: 'VALIDATION', message: 'sectionOrder must be a number' });
      }

      bulkOps.push({
        updateOne: {
          filter: { organizationId, quoteId, quoteSectionId: String(id) },
          update: { $set: { sectionOrder: order } }
        }
      });
    }

    await QuoteSection.bulkWrite(bulkOps, { ordered: false });
    const sections = await listQuoteSections({ organizationId, quoteId });

    return res.json({ success: true, data: { sections } });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' || err?.code === 'APPROVAL_LOCKED' || err?.code === 'QUOTE_COMMERCIALLY_LOCKED'
        ? 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to reorder quote sections',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

/**
 * DELETE /api/quotes/:id/sections/:sectionId
 */
async function deleteSection(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const quoteId = req.params.id;

    const quote = await Quote.findOne({ _id: quoteId, organizationId });
    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found', code: 'NOT_FOUND' });
    }

    const override = req.body?.overridePricing === true;
    assertQuoteEditableForSectionWrite({ quote, overridePricing: override, req });

    const section = await findSectionOrThrow({ organizationId, quoteId, sectionId: req.params.sectionId });

    const lineCount = await countLinesInSection({
      organizationId,
      quoteId,
      sectionId: section._id
    });
    if (lineCount > 0) {
      return res.status(400).json({
        success: false,
        code: 'SECTION_HAS_LINES',
        message: 'Move or delete lines before removing this section'
      });
    }

    const sectionCount = await QuoteSection.countDocuments({ organizationId, quoteId });
    if (sectionCount <= 1) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION',
        message: 'Cannot delete the only section on a quote'
      });
    }

    await section.deleteOne();

    const { totals, sections } = await recomputeQuoteAndSectionTotals({ organizationId, quoteId: quote._id });

    await writeQuoteActivity({
      organizationId,
      quoteId: quote._id,
      userId: req.user._id,
      action: 'quote_section_deleted',
      message: `Section deleted: ${section.sectionTitle}`,
      details: { quoteSectionId: section.quoteSectionId, totals }
    });

    return res.json({ success: true, data: { sections, totals } });
  } catch (err) {
    const status =
      err?.code === 'VALIDATION' ||
      err?.code === 'APPROVAL_LOCKED' ||
      err?.code === 'QUOTE_COMMERCIALLY_LOCKED' ||
      err?.code === 'SECTION_NOT_FOUND' ||
      err?.code === 'SECTION_HAS_LINES'
        ? err?.code === 'SECTION_NOT_FOUND'
          ? 404
          : 400
        : 500;
    return res.status(status).json({
      success: false,
      message: err.message || 'Failed to delete quote section',
      code: err?.code || 'UNKNOWN',
      details: err?.details || null
    });
  }
}

module.exports = {
  listSections,
  createSection,
  patchSection,
  patchSectionDiscounts,
  reorderSections,
  deleteSection
};
