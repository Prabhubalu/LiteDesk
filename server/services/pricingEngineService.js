/**
 * Commercial pricing engine — price books + rules + promotions.
 * Always snapshots list price + unit price + applied breakdown for audit.
 */

const ItemVariant = require('../models/ItemVariant');
const Item = require('../models/Item');
const CatalogPriceBook = require('../models/CatalogPriceBook');
const { resolve: resolveCatalogPrice } = require('./catalogPriceResolver');
const { listRules } = require('./pricingRuleService');
const { listPromotions } = require('./pricingPromotionService');
const { runPricingPipeline, selectBestPriceBook } = require('./pricingCalculation');
const { normalizeCustomerType, roundMoney } = require('../constants/pricingEngine');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');
const { ADDON_KEYS } = require('../constants/addonKeys');

function normalizeContext(raw = {}) {
  return {
    customerType: normalizeCustomerType(raw.customerType),
    regionCode: raw.regionCode ? String(raw.regionCode).trim().toUpperCase() : null,
    channel: raw.channel ? String(raw.channel).trim() : null,
    customerId: raw.customerId || null,
    currency: raw.currency ? String(raw.currency).trim().toUpperCase() : null,
    orderSubtotal: raw.orderSubtotal != null ? Number(raw.orderSubtotal) : undefined,
    variantId: raw.variantId || null,
    itemId: raw.itemId || null,
    itemGroupId: raw.itemGroupId || null,
  };
}

/**
 * Pick applicable price book id from context when caller did not force one.
 */
async function resolvePriceBookId({ organizationId, priceBookId, context, asOf }) {
  if (priceBookId) return priceBookId;
  const books = await CatalogPriceBook.find({ organizationId, isActive: true }).lean();
  const best = selectBestPriceBook(books, {
    customerType: context.customerType,
    regionCode: context.regionCode,
    currency: context.currency,
    asOf: asOf || new Date(),
  });
  return best?._id || null;
}

/**
 * Full commercial resolve used by Quotes / Sales Orders / preview API.
 *
 * @returns {{
 *   unitPrice, listPrice, currency, source, priceBookId, priceBookName, entryId,
 *   minQty, effectiveFrom, effectiveTo, pricingBreakdown
 * }}
 */
async function resolveCommercialPrice({
  organizationId,
  variantId,
  priceBookId = null,
  quantity = 1,
  asOfDate = null,
  context: rawContext = {},
  applyRulesAndPromotions = true,
}) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  if (Number.isNaN(asOf.getTime())) {
    const err = new Error('Invalid asOfDate');
    err.code = 'VALIDATION';
    throw err;
  }

  const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).lean();
  if (!variant) {
    const err = new Error('Variant not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const item = await Item.findOne({
    _id: variant.itemId,
    organizationId,
    deletedAt: null,
  })
    .select('_id itemGroupId')
    .lean();

  const context = normalizeContext({
    ...rawContext,
    variantId,
    itemId: item?._id || variant.itemId || null,
    itemGroupId: item?.itemGroupId || null,
  });

  const selectedBookId = await resolvePriceBookId({
    organizationId,
    priceBookId,
    context: { ...context, currency: context.currency },
    asOf,
  });

  const base = await resolveCatalogPrice({
    organizationId,
    variantId,
    priceBookId: selectedBookId,
    quantity,
    asOfDate: asOf,
  });

  const listPrice = roundMoney(base.unitPrice);
  let unitPrice = listPrice;
  let applied = [];
  let rejections = [];

  const cpqEntitled =
    applyRulesAndPromotions === true
      ? await isAddonEntitledForOrg(organizationId, ADDON_KEYS.CPQ)
      : false;
  const runAdvanced = applyRulesAndPromotions !== false && cpqEntitled;

  if (runAdvanced) {
    const [rules, promotions] = await Promise.all([
      listRules(organizationId, { includeInactive: false }),
      listPromotions(organizationId, { includeInactive: false }),
    ]);
    const pipeline = runPricingPipeline({
      baseUnitPrice: listPrice,
      quantity,
      asOf,
      context,
      rules,
      promotions,
    });
    unitPrice = pipeline.unitPrice;
    applied = pipeline.applied;
    rejections = pipeline.rejections;
  }

  const pricingBreakdown = {
    version: 1,
    asOf: asOf.toISOString(),
    context: {
      customerType: context.customerType,
      regionCode: context.regionCode,
      channel: context.channel,
      customerId: context.customerId ? String(context.customerId) : null,
      currency: context.currency || base.currency || null,
      quantity: Math.max(1, Number(quantity) || 1),
    },
    base: {
      unitPrice: listPrice,
      source: base.source,
      priceBookId: base.priceBookId ? String(base.priceBookId) : null,
      priceBookName: base.priceBookName || null,
      entryId: base.entryId ? String(base.entryId) : null,
      minQty: base.minQty ?? null,
      effectiveFrom: base.effectiveFrom || null,
      effectiveTo: base.effectiveTo || null,
    },
    applied,
    rejections,
    listPrice,
    unitPrice,
    totalDiscountPerUnit: roundMoney(listPrice - unitPrice),
  };

  return {
    unitPrice,
    listPrice,
    currency: base.currency,
    source: base.source,
    priceBookId: base.priceBookId,
    priceBookName: base.priceBookName,
    entryId: base.entryId,
    minQty: base.minQty,
    effectiveFrom: base.effectiveFrom,
    effectiveTo: base.effectiveTo,
    pricingBreakdown,
  };
}

module.exports = {
  resolveCommercialPrice,
  resolvePriceBookId,
  normalizeContext,
};
