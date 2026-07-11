/**
 * CommercialConversionService — boundary between Deal commercial intent and formal documents.
 *
 * Quote (and later Order / Subscription / Invoice) must not read DealLines directly.
 * All Deal → document conversion flows through this service.
 *
 * Phase 1: contract + DealLine → conversion DTO. Quote write path lands when product enables it.
 */

const Deal = require('../models/Deal');
const dealPricingService = require('./dealPricingService');

function conversionError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Build a document-agnostic commercial snapshot from a Deal + its DealLines.
 * Downstream converters (Quote, Order, …) consume this DTO only.
 *
 * @returns {{
 *   source: { type: 'deal', dealId, organizationId, amount, amountMode, currency, name },
 *   lines: Array<object>,
 *   totals: { subtotal, taxTotal, grandTotal, lineCount }
 * }}
 */
async function buildDealCommercialSnapshot({ organizationId, dealId }) {
  const deal = await Deal.findOne({ _id: dealId, organizationId, deletedAt: null }).lean();
  if (!deal) throw conversionError('DEAL_NOT_FOUND', 'Deal not found', 404);

  const lines = await dealPricingService.listActiveLines(organizationId, dealId);
  const totals = dealPricingService.computeGrandTotalFromLines(lines);

  return {
    source: {
      type: 'deal',
      dealId: deal._id,
      organizationId: deal.organizationId,
      name: deal.name,
      amount: deal.amount,
      amountMode: deal.amountMode,
      currency: deal.currency,
      linesGrandTotal: deal.linesGrandTotal
    },
    lines: lines.map((line) => dealPricingService.serializeLine(line)),
    totals
  };
}

/**
 * Convert Deal → Quote draft payload (no persistence yet).
 * Callers that persist must create Quote + QuoteLines from this payload via quote services.
 *
 * @returns {{ snapshot, quoteDraft: { quoteTitle, currency, dealId, lines: Array } }}
 */
async function convertDealToQuoteDraft({ organizationId, dealId }) {
  const snapshot = await buildDealCommercialSnapshot({ organizationId, dealId });

  const quoteDraft = {
    quoteTitle: snapshot.source.name,
    currency: snapshot.source.currency || 'USD',
    dealId: snapshot.source.dealId,
    lines: snapshot.lines.map((line, index) => ({
      lineOrder: line.lineOrder ?? index + 1,
      lineType: line.lineType === 'product' ? 'standard' : 'adjustment',
      variantId: line.variantId || null,
      quantity: line.quantity,
      unitOfMeasure: line.unitOfMeasureSnapshot,
      unitPriceSnapshot: line.expectedUnitPrice,
      listPriceSnapshot: line.listPriceSnapshot,
      discountType: line.discountType,
      discountValue: line.discountValue,
      discountAmount: line.discountAmount,
      taxSnapshot: line.taxSnapshot,
      currencySnapshot: line.currencySnapshot,
      skuSnapshot: line.skuSnapshot,
      itemNameSnapshot: line.nameSnapshot,
      descriptionSnapshot: line.descriptionSnapshot,
      // Non-catalog deal lines need quote-side handling before persist
      requiresCatalogVariant: Boolean(line.variantId),
      sourceDealLineId: line.dealLineId
    }))
  };

  return { snapshot, quoteDraft };
}

module.exports = {
  buildDealCommercialSnapshot,
  convertDealToQuoteDraft
};
