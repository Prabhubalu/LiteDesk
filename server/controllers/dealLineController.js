/**
 * DealLine HTTP handlers — thin; all money math lives in DealPricingService.
 */

const dealPricingService = require('../services/dealPricingService');
const { normalizeDealAmountMode } = require('../constants/dealAmountMode');

function sendPricingError(res, err) {
  const status = err.status || (err.code === 'DEAL_NOT_FOUND' || err.code === 'LINE_NOT_FOUND' ? 404 : 400);
  return res.status(status).json({
    success: false,
    code: err.code || 'DEAL_PRICING_ERROR',
    message: err.message || 'Deal pricing error'
  });
}

function dealPayload(deal) {
  if (!deal) return null;
  const o = typeof deal.toObject === 'function' ? deal.toObject() : deal;
  return {
    _id: o._id,
    amount: o.amount,
    amountMode: o.amountMode,
    linesGrandTotal: o.linesGrandTotal,
    currency: o.currency
  };
}

/**
 * GET /api/deals/:id/lines
 */
exports.listDealLines = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const dealId = req.params.id;
    const result = await dealPricingService.recalculateDeal({
      organizationId,
      dealId,
      actorId: null
    });
    // recalculate ensures totals are fresh; list without mutating when possible would be ideal,
    // but recalculate is idempotent for MANUAL and correct for AUTO.
    return res.json({
      success: true,
      data: {
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] listDealLines:', err);
    return res.status(500).json({ success: false, message: 'Failed to list deal lines' });
  }
};

/**
 * Prefer list without forced recalculate for read path.
 */
exports.getDealLines = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const dealId = req.params.id;
    const Deal = require('../models/Deal');
    const deal = await Deal.findOne({ _id: dealId, organizationId, deletedAt: null })
      .select('amount amountMode linesGrandTotal currency')
      .lean();
    if (!deal) {
      return res.status(404).json({ success: false, code: 'DEAL_NOT_FOUND', message: 'Deal not found' });
    }
    const lines = await dealPricingService.listActiveLines(organizationId, dealId);
    const totals = dealPricingService.computeGrandTotalFromLines(lines);
    return res.json({
      success: true,
      data: {
        lines: lines.map(dealPricingService.serializeLine),
        totals,
        deal: dealPayload(deal)
      }
    });
  } catch (err) {
    console.error('[dealLineController] getDealLines:', err);
    return res.status(500).json({ success: false, message: 'Failed to get deal lines' });
  }
};

/**
 * POST /api/deals/:id/lines
 */
exports.addDealLine = async (req, res) => {
  try {
    const result = await dealPricingService.addLine({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      actorId: req.user._id,
      input: req.body || {}
    });
    return res.status(201).json({
      success: true,
      data: {
        line: dealPricingService.serializeLine(result.line),
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] addDealLine:', err);
    return res.status(500).json({ success: false, message: 'Failed to add deal line' });
  }
};

/**
 * PATCH /api/deals/:id/lines/:lineId
 */
exports.patchDealLine = async (req, res) => {
  try {
    const result = await dealPricingService.updateLine({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      lineId: req.params.lineId,
      actorId: req.user._id,
      input: req.body || {}
    });
    return res.json({
      success: true,
      data: {
        line: dealPricingService.serializeLine(result.line),
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] patchDealLine:', err);
    return res.status(500).json({ success: false, message: 'Failed to update deal line' });
  }
};

/**
 * DELETE /api/deals/:id/lines/:lineId
 */
exports.deleteDealLine = async (req, res) => {
  try {
    const result = await dealPricingService.removeLine({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      lineId: req.params.lineId,
      actorId: req.user._id
    });
    return res.json({
      success: true,
      data: {
        line: dealPricingService.serializeLine(result.line),
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] deleteDealLine:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete deal line' });
  }
};

/**
 * PATCH /api/deals/:id/lines/reorder
 * Body: { orderedLineIds: string[] }
 */
exports.reorderDealLines = async (req, res) => {
  try {
    const result = await dealPricingService.reorderLines({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      orderedLineIds: req.body?.orderedLineIds,
      actorId: req.user._id
    });
    return res.json({
      success: true,
      data: {
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] reorderDealLines:', err);
    return res.status(500).json({ success: false, message: 'Failed to reorder deal lines' });
  }
};

/**
 * PATCH /api/deals/:id/amount-mode
 * Body: { amountMode: 'AUTO'|'MANUAL', amount?: number } — amount only valid with MANUAL transition
 */
exports.patchDealAmountMode = async (req, res) => {
  try {
    const amountMode = normalizeDealAmountMode(req.body?.amountMode);
    if (!amountMode) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_AMOUNT_MODE',
        message: 'amountMode must be AUTO or MANUAL'
      });
    }
    const result = await dealPricingService.setAmountMode({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      amountMode,
      amount: req.body?.amount,
      actorId: req.user._id
    });
    return res.json({
      success: true,
      data: {
        deal: dealPayload(result.deal),
        lines: result.lines ? result.lines.map(dealPricingService.serializeLine) : undefined,
        totals: result.totals,
        changed: result.changed
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] patchDealAmountMode:', err);
    return res.status(500).json({ success: false, message: 'Failed to update amount mode' });
  }
};

/**
 * POST /api/deals/:id/lines/recalculate
 */
exports.recalculateDealLines = async (req, res) => {
  try {
    const result = await dealPricingService.recalculateDeal({
      organizationId: req.user.organizationId,
      dealId: req.params.id,
      actorId: req.user._id
    });
    return res.json({
      success: true,
      data: {
        lines: result.lines.map(dealPricingService.serializeLine),
        totals: result.totals,
        deal: dealPayload(result.deal)
      }
    });
  } catch (err) {
    if (err.code) return sendPricingError(res, err);
    console.error('[dealLineController] recalculateDealLines:', err);
    return res.status(500).json({ success: false, message: 'Failed to recalculate deal lines' });
  }
};
