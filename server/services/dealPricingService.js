/**
 * DealPricingService — sole owner of DealLine totals, grand total, amount sync, and amountMode transitions.
 * Controllers must not compute line/deal money; call this service instead.
 *
 * Reuses quoteTotalsService math (shared calculation), not QuoteLine schema.
 */

const Deal = require('../models/Deal');
const DealLine = require('../models/DealLine');
const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const { computeLineTotals, computeDiscountAmount } = require('./quoteTotalsService');
const { resolve: resolveCatalogPrice } = require('./catalogPriceResolver');
const {
  DEAL_AMOUNT_MODE,
  normalizeDealAmountMode,
  DEFAULT_DEAL_AMOUNT_MODE
} = require('../constants/dealAmountMode');
const { normalizeDealLineType, DEFAULT_DEAL_LINE_TYPE } = require('../constants/dealLineTypes');
const { CURRENT_DEAL_PRICING_VERSION } = require('../constants/dealPricingVersion');
const { generateDealLineId } = require('../models/DealLine');

function pricingError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Map DealLine fields onto the shape computeLineTotals expects (unitPriceSnapshot).
 */
function toCalcLine(line) {
  return {
    quantity: line.quantity,
    unitPriceSnapshot: line.expectedUnitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    discountAmount: line.discountAmount
  };
}

function applyComputedTotals(lineDoc, computed) {
  lineDoc.lineSubtotal = computed.lineSubtotal;
  lineDoc.lineTaxTotal = computed.lineTaxTotal;
  lineDoc.lineTotal = computed.lineTotal;
  if (computed.lineDiscount != null && Number(lineDoc.discountAmount) <= 0) {
    // Keep discountAmount aligned when type/value drove the discount
    if (lineDoc.discountType) {
      lineDoc.discountAmount = computed.lineDiscount;
    }
  }
}

function computeGrandTotalFromLines(lines) {
  const included = (Array.isArray(lines) ? lines : []).filter((l) => l && !l.deletedAt);
  const subtotal = included.reduce((sum, l) => sum + (Number(l.lineSubtotal) || 0), 0);
  const taxTotal = included.reduce((sum, l) => sum + (Number(l.lineTaxTotal) || 0), 0);
  const grandTotal = Math.max(0, subtotal + taxTotal);
  return { subtotal, taxTotal, grandTotal, lineCount: included.length };
}

async function loadActiveDeal(organizationId, dealId) {
  const deal = await Deal.findOne({ _id: dealId, organizationId, deletedAt: null });
  if (!deal) throw pricingError('DEAL_NOT_FOUND', 'Deal not found', 404);
  return deal;
}

async function listActiveLines(organizationId, dealId) {
  return DealLine.find({
    organizationId,
    dealId,
    deletedAt: null
  }).sort({ lineOrder: 1, createdAt: 1 });
}

/**
 * Recalculate all active lines and sync Deal.amount when amountMode=AUTO.
 * @returns {{ deal, lines, totals }}
 */
async function recalculateDeal({ organizationId, dealId, actorId = null }) {
  const deal = await loadActiveDeal(organizationId, dealId);
  const lines = await listActiveLines(organizationId, dealId);

  for (const line of lines) {
    const computed = computeLineTotals(toCalcLine(line));
    applyComputedTotals(line, computed);
    line.pricingVersion = line.pricingVersion || CURRENT_DEAL_PRICING_VERSION;
    if (actorId) line.modifiedBy = actorId;
    await line.save();
  }

  const totals = computeGrandTotalFromLines(lines);
  deal.linesGrandTotal = totals.grandTotal;

  const mode = normalizeDealAmountMode(deal.amountMode) || DEFAULT_DEAL_AMOUNT_MODE;
  if (mode === DEAL_AMOUNT_MODE.AUTO) {
    deal.amount = totals.grandTotal;
  }

  if (actorId) deal.modifiedBy = actorId;
  await deal.save();

  return { deal, lines, totals };
}

/**
 * Explicit amountMode transition. Service owns the transition — reject conflicting amount in same request.
 *
 * @param {{ organizationId, dealId, amountMode, amount?, actorId? }}
 */
async function setAmountMode({ organizationId, dealId, amountMode, amount, actorId = null }) {
  const nextMode = normalizeDealAmountMode(amountMode);
  if (!nextMode) {
    throw pricingError('INVALID_AMOUNT_MODE', 'amountMode must be AUTO or MANUAL');
  }

  if (amount !== undefined && nextMode === DEAL_AMOUNT_MODE.AUTO) {
    throw pricingError(
      'AMOUNT_MODE_CONFLICT',
      'Cannot set amount and amountMode=AUTO in the same request. Switch mode first; service recalculates amount.'
    );
  }

  const deal = await loadActiveDeal(organizationId, dealId);
  const prevMode = normalizeDealAmountMode(deal.amountMode) || DEFAULT_DEAL_AMOUNT_MODE;

  if (prevMode === nextMode) {
    if (nextMode === DEAL_AMOUNT_MODE.MANUAL && amount !== undefined) {
      const nextAmount = Number(amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        throw pricingError('INVALID_AMOUNT', 'amount must be a non-negative number');
      }
      deal.amount = nextAmount;
      if (actorId) deal.modifiedBy = actorId;
      await deal.save();
      return { deal, changed: false };
    }
    return { deal, changed: false };
  }

  deal.amountMode = nextMode;

  if (nextMode === DEAL_AMOUNT_MODE.AUTO) {
    if (actorId) deal.modifiedBy = actorId;
    await deal.save();
    const result = await recalculateDeal({ organizationId, dealId, actorId });
    return { deal: result.deal, lines: result.lines, totals: result.totals, changed: true };
  }

  // AUTO → MANUAL: keep current amount unless explicit amount provided (allowed only with MANUAL)
  if (amount !== undefined) {
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      throw pricingError('INVALID_AMOUNT', 'amount must be a non-negative number');
    }
    deal.amount = nextAmount;
  }
  if (actorId) deal.modifiedBy = actorId;
  await deal.save();
  return { deal, changed: true };
}

/**
 * Apply MANUAL amount update. Rejected when amountMode=AUTO.
 */
async function setManualAmount({ organizationId, dealId, amount, actorId = null }) {
  const deal = await loadActiveDeal(organizationId, dealId);
  const mode = normalizeDealAmountMode(deal.amountMode) || DEFAULT_DEAL_AMOUNT_MODE;
  if (mode === DEAL_AMOUNT_MODE.AUTO) {
    throw pricingError(
      'AMOUNT_LOCKED_AUTO',
      'Deal amount is AUTO from lines. Switch amountMode to MANUAL before setting amount.'
    );
  }
  const nextAmount = Number(amount);
  if (!Number.isFinite(nextAmount) || nextAmount < 0) {
    throw pricingError('INVALID_AMOUNT', 'amount must be a non-negative number');
  }
  deal.amount = nextAmount;
  if (actorId) deal.modifiedBy = actorId;
  await deal.save();
  return { deal };
}

async function resolveCatalogSnapshots({
  organizationId,
  itemId,
  variantId,
  quantity,
  priceBookId,
  currencyFallback
}) {
  let resolvedVariantId = variantId || null;
  let resolvedItemId = itemId || null;
  let skuSnapshot = null;
  let nameSnapshot = null;
  let descriptionSnapshot = null;
  let unitOfMeasureSnapshot = null;
  let expectedUnitPrice = 0;
  let listPriceSnapshot = 0;
  let pricingSourceSnapshot = null;
  let priceBookIdSnapshot = null;
  let priceBookNameSnapshot = null;
  let priceBookEntryIdSnapshot = null;
  let pricingAsOfDateSnapshot = new Date();
  let currencySnapshot = currencyFallback || 'USD';

  if (resolvedVariantId || resolvedItemId) {
    let variant = null;
    if (resolvedVariantId) {
      variant = await ItemVariant.findOne({ _id: resolvedVariantId, organizationId }).lean();
    } else if (resolvedItemId) {
      variant = await ItemVariant.findOne({
        organizationId,
        itemId: resolvedItemId,
        is_default: true
      }).lean();
      if (!variant) {
        variant = await ItemVariant.findOne({ organizationId, itemId: resolvedItemId }).lean();
      }
    }

    if (!variant) {
      throw pricingError('VARIANT_NOT_FOUND', 'Catalog item/variant not found', 404);
    }

    resolvedVariantId = variant._id;
    resolvedItemId = variant.itemId || resolvedItemId;

    const item = resolvedItemId
      ? await Item.findOne({ _id: resolvedItemId, organizationId }).lean()
      : null;

    skuSnapshot = variant.variant_code || variant.barcode || item?.item_code || null;
    nameSnapshot = item?.item_name || variant.variant_code || null;
    descriptionSnapshot = item?.description || null;
    unitOfMeasureSnapshot = variant.unit_of_measure || item?.unit_of_measure || null;

    try {
      const price = await resolveCatalogPrice({
        organizationId,
        variantId: resolvedVariantId,
        priceBookId: priceBookId || null,
        quantity: quantity || 1,
        asOfDate: pricingAsOfDateSnapshot
      });
      expectedUnitPrice = Number(price.unitPrice) || 0;
      listPriceSnapshot = expectedUnitPrice;
      pricingSourceSnapshot = price.source || null;
      priceBookIdSnapshot = price.priceBookId || null;
      priceBookNameSnapshot = price.priceBookName || null;
      priceBookEntryIdSnapshot = price.entryId || null;
      currencySnapshot = price.currency || currencySnapshot;
    } catch (err) {
      // Fallback to variant selling price when price book resolve fails
      expectedUnitPrice = Number(variant.selling_price) || 0;
      listPriceSnapshot = expectedUnitPrice;
      pricingSourceSnapshot = 'variant_fallback';
      currencySnapshot = variant.currency || currencySnapshot;
      if (err.code === 'NOT_FOUND' || err.code === 'VALIDATION') {
        // keep fallback
      } else {
        throw err;
      }
    }
  }

  return {
    itemId: resolvedItemId,
    variantId: resolvedVariantId,
    skuSnapshot,
    nameSnapshot,
    descriptionSnapshot,
    unitOfMeasureSnapshot,
    expectedUnitPrice,
    listPriceSnapshot,
    pricingSourceSnapshot,
    priceBookIdSnapshot,
    priceBookNameSnapshot,
    priceBookEntryIdSnapshot,
    pricingAsOfDateSnapshot,
    currencySnapshot
  };
}

function assertLineIdentity(input) {
  const lineType = normalizeDealLineType(input.lineType) || DEFAULT_DEAL_LINE_TYPE;
  const hasCatalog = Boolean(input.itemId || input.variantId);
  const hasName = Boolean(String(input.nameSnapshot || input.name || '').trim());

  if (!hasCatalog && !hasName && lineType === 'product') {
    throw pricingError(
      'LINE_IDENTITY_REQUIRED',
      'Product lines require itemId/variantId or a nameSnapshot'
    );
  }
  if (!hasCatalog && !hasName) {
    throw pricingError(
      'LINE_IDENTITY_REQUIRED',
      'Non-catalog lines require a name (nameSnapshot)'
    );
  }
  return lineType;
}

/**
 * Create a DealLine, snapshot catalog values, recalculate deal.
 */
async function addLine({
  organizationId,
  dealId,
  actorId,
  input = {}
}) {
  const deal = await loadActiveDeal(organizationId, dealId);
  const lineType = assertLineIdentity(input);
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw pricingError('INVALID_QUANTITY', 'quantity is required and must be >= 0');
  }
  if (quantity === 0 && lineType === 'product') {
    throw pricingError('INVALID_QUANTITY', 'quantity must be greater than 0');
  }

  const snapshots = await resolveCatalogSnapshots({
    organizationId,
    itemId: input.itemId || null,
    variantId: input.variantId || null,
    quantity,
    priceBookId: input.priceBookId || null,
    currencyFallback: deal.currency
  });

  // Allow explicit unit price override (still snapshotted on the line)
  if (input.expectedUnitPrice !== undefined && input.expectedUnitPrice !== null) {
    const override = Number(input.expectedUnitPrice);
    if (!Number.isFinite(override) || override < 0) {
      throw pricingError('INVALID_UNIT_PRICE', 'expectedUnitPrice must be a non-negative number');
    }
    snapshots.expectedUnitPrice = override;
    if (!snapshots.pricingSourceSnapshot) snapshots.pricingSourceSnapshot = 'manual';
  }

  if (!snapshots.nameSnapshot && input.nameSnapshot) {
    snapshots.nameSnapshot = String(input.nameSnapshot).trim();
  }
  if (!snapshots.nameSnapshot && input.name) {
    snapshots.nameSnapshot = String(input.name).trim();
  }
  if (input.descriptionSnapshot != null) {
    snapshots.descriptionSnapshot = String(input.descriptionSnapshot);
  }
  if (input.unitOfMeasureSnapshot != null) {
    snapshots.unitOfMeasureSnapshot = String(input.unitOfMeasureSnapshot).trim() || null;
  }
  if (input.skuSnapshot != null && !snapshots.skuSnapshot) {
    snapshots.skuSnapshot = String(input.skuSnapshot).trim() || null;
  }
  if (input.currencySnapshot) {
    snapshots.currencySnapshot = String(input.currencySnapshot).trim().toUpperCase();
  }

  const maxOrder = await DealLine.findOne({ organizationId, dealId, deletedAt: null })
    .sort({ lineOrder: -1 })
    .select('lineOrder')
    .lean();
  const lineOrder = input.lineOrder != null
    ? Number(input.lineOrder)
    : (Number(maxOrder?.lineOrder) || 0) + 1;

  const line = new DealLine({
    organizationId,
    dealId,
    dealLineId: generateDealLineId(),
    lineType,
    lineOrder,
    itemId: snapshots.itemId,
    variantId: snapshots.variantId,
    quantity,
    skuSnapshot: snapshots.skuSnapshot,
    nameSnapshot: snapshots.nameSnapshot,
    descriptionSnapshot: snapshots.descriptionSnapshot,
    unitOfMeasureSnapshot: snapshots.unitOfMeasureSnapshot,
    expectedUnitPrice: snapshots.expectedUnitPrice,
    listPriceSnapshot: snapshots.listPriceSnapshot,
    pricingSourceSnapshot: snapshots.pricingSourceSnapshot,
    priceBookIdSnapshot: snapshots.priceBookIdSnapshot,
    priceBookNameSnapshot: snapshots.priceBookNameSnapshot,
    priceBookEntryIdSnapshot: snapshots.priceBookEntryIdSnapshot,
    pricingAsOfDateSnapshot: snapshots.pricingAsOfDateSnapshot,
    discountType: input.discountType ?? null,
    discountValue: Number(input.discountValue) || 0,
    discountAmount: Number(input.discountAmount) || 0,
    taxSnapshot: input.taxSnapshot && typeof input.taxSnapshot === 'object' ? input.taxSnapshot : {},
    currencySnapshot: snapshots.currencySnapshot,
    exchangeRateSnapshot: Number(input.exchangeRateSnapshot) || 1,
    pricingVersion: CURRENT_DEAL_PRICING_VERSION,
    createdBy: actorId || null,
    modifiedBy: actorId || null
  });

  const computed = computeLineTotals(toCalcLine(line));
  applyComputedTotals(line, computed);
  await line.save();

  const result = await recalculateDeal({ organizationId, dealId, actorId });
  return { line, ...result };
}

async function updateLine({
  organizationId,
  dealId,
  lineId,
  actorId,
  input = {}
}) {
  await loadActiveDeal(organizationId, dealId);

  const line = await DealLine.findOne({
    organizationId,
    dealId,
    deletedAt: null,
    $or: [{ _id: lineId }, { dealLineId: lineId }]
  });
  if (!line) throw pricingError('LINE_NOT_FOUND', 'Deal line not found', 404);

  if (input.lineType !== undefined) {
    const nextType = normalizeDealLineType(input.lineType);
    if (!nextType) throw pricingError('INVALID_LINE_TYPE', 'Invalid lineType');
    line.lineType = nextType;
  }

  if (input.quantity !== undefined) {
    const quantity = Number(input.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw pricingError('INVALID_QUANTITY', 'quantity must be >= 0');
    }
    line.quantity = quantity;
  }

  const catalogChanging =
    input.itemId !== undefined ||
    input.variantId !== undefined ||
    input.priceBookId !== undefined ||
    input.resnapshot === true;

  if (catalogChanging) {
    const snapshots = await resolveCatalogSnapshots({
      organizationId,
      itemId: input.itemId !== undefined ? input.itemId : line.itemId,
      variantId: input.variantId !== undefined ? input.variantId : line.variantId,
      quantity: line.quantity,
      priceBookId: input.priceBookId || null,
      currencyFallback: line.currencySnapshot
    });
    Object.assign(line, {
      itemId: snapshots.itemId,
      variantId: snapshots.variantId,
      skuSnapshot: snapshots.skuSnapshot ?? line.skuSnapshot,
      nameSnapshot: snapshots.nameSnapshot ?? line.nameSnapshot,
      descriptionSnapshot: snapshots.descriptionSnapshot ?? line.descriptionSnapshot,
      unitOfMeasureSnapshot: snapshots.unitOfMeasureSnapshot ?? line.unitOfMeasureSnapshot,
      expectedUnitPrice: snapshots.expectedUnitPrice,
      listPriceSnapshot: snapshots.listPriceSnapshot,
      pricingSourceSnapshot: snapshots.pricingSourceSnapshot,
      priceBookIdSnapshot: snapshots.priceBookIdSnapshot,
      priceBookNameSnapshot: snapshots.priceBookNameSnapshot,
      priceBookEntryIdSnapshot: snapshots.priceBookEntryIdSnapshot,
      pricingAsOfDateSnapshot: snapshots.pricingAsOfDateSnapshot,
      currencySnapshot: snapshots.currencySnapshot || line.currencySnapshot
    });
  }

  if (input.expectedUnitPrice !== undefined) {
    const override = Number(input.expectedUnitPrice);
    if (!Number.isFinite(override) || override < 0) {
      throw pricingError('INVALID_UNIT_PRICE', 'expectedUnitPrice must be a non-negative number');
    }
    line.expectedUnitPrice = override;
    if (!line.pricingSourceSnapshot || line.pricingSourceSnapshot === 'price_book') {
      line.pricingSourceSnapshot = 'manual';
    }
  }

  if (input.nameSnapshot !== undefined) line.nameSnapshot = String(input.nameSnapshot || '').trim() || null;
  if (input.descriptionSnapshot !== undefined) line.descriptionSnapshot = input.descriptionSnapshot;
  if (input.unitOfMeasureSnapshot !== undefined) {
    line.unitOfMeasureSnapshot = String(input.unitOfMeasureSnapshot || '').trim() || null;
  }
  if (input.skuSnapshot !== undefined) line.skuSnapshot = String(input.skuSnapshot || '').trim() || null;
  if (input.discountType !== undefined) line.discountType = input.discountType;
  if (input.discountValue !== undefined) line.discountValue = Number(input.discountValue) || 0;
  if (input.discountAmount !== undefined) line.discountAmount = Number(input.discountAmount) || 0;
  if (input.taxSnapshot !== undefined && typeof input.taxSnapshot === 'object') {
    line.taxSnapshot = input.taxSnapshot;
  }
  if (input.lineOrder !== undefined) line.lineOrder = Number(input.lineOrder) || 0;
  if (input.currencySnapshot !== undefined) {
    line.currencySnapshot = String(input.currencySnapshot).trim().toUpperCase();
  }

  line.pricingVersion = CURRENT_DEAL_PRICING_VERSION;
  if (actorId) line.modifiedBy = actorId;

  const computed = computeLineTotals(toCalcLine(line));
  applyComputedTotals(line, computed);
  await line.save();

  const result = await recalculateDeal({ organizationId, dealId, actorId });
  return { line, ...result };
}

async function removeLine({ organizationId, dealId, lineId, actorId }) {
  await loadActiveDeal(organizationId, dealId);

  const line = await DealLine.findOne({
    organizationId,
    dealId,
    deletedAt: null,
    $or: [{ _id: lineId }, { dealLineId: lineId }]
  });
  if (!line) throw pricingError('LINE_NOT_FOUND', 'Deal line not found', 404);

  line.deletedAt = new Date();
  line.deletedBy = actorId || null;
  if (actorId) line.modifiedBy = actorId;
  await line.save();

  const result = await recalculateDeal({ organizationId, dealId, actorId });
  return { line, ...result };
}

async function reorderLines({ organizationId, dealId, orderedLineIds, actorId }) {
  await loadActiveDeal(organizationId, dealId);
  const ids = Array.isArray(orderedLineIds) ? orderedLineIds.map(String) : [];
  if (!ids.length) throw pricingError('INVALID_REORDER', 'orderedLineIds is required');

  const lines = await listActiveLines(organizationId, dealId);
  const byKey = new Map();
  for (const line of lines) {
    byKey.set(String(line._id), line);
    byKey.set(String(line.dealLineId), line);
  }

  let order = 1;
  for (const id of ids) {
    const line = byKey.get(String(id));
    if (!line) continue;
    line.lineOrder = order++;
    if (actorId) line.modifiedBy = actorId;
    await line.save();
  }

  return recalculateDeal({ organizationId, dealId, actorId });
}

/**
 * Soft-delete all lines with the parent Deal (aggregate trash).
 */
async function softDeleteLinesForDeal({ organizationId, dealId, actorId }) {
  const now = new Date();
  await DealLine.updateMany(
    { organizationId, dealId, deletedAt: null },
    { $set: { deletedAt: now, deletedBy: actorId || null, modifiedBy: actorId || null } }
  );
}

/**
 * Restore lines soft-deleted with the parent Deal.
 */
async function restoreLinesForDeal({ organizationId, dealId, actorId, deletedAt = null }) {
  const filter = { organizationId, dealId, deletedAt: { $ne: null } };
  if (deletedAt) {
    // Prefer lines deleted in the same trash window when provided
    filter.deletedAt = deletedAt;
  }
  await DealLine.updateMany(
    filter,
    { $set: { deletedAt: null, deletedBy: null, modifiedBy: actorId || null } }
  );
  return recalculateDeal({ organizationId, dealId, actorId });
}

/**
 * Clone DealLines onto a new Deal (aggregate clone invariant).
 */
async function cloneLinesForDeal({
  organizationId,
  sourceDealId,
  targetDealId,
  actorId
}) {
  const sourceLines = await listActiveLines(organizationId, sourceDealId);
  const created = [];

  for (const src of sourceLines) {
    const copy = new DealLine({
      organizationId,
      dealId: targetDealId,
      dealLineId: generateDealLineId(),
      lineType: src.lineType,
      lineOrder: src.lineOrder,
      itemId: src.itemId,
      variantId: src.variantId,
      quantity: src.quantity,
      skuSnapshot: src.skuSnapshot,
      nameSnapshot: src.nameSnapshot,
      descriptionSnapshot: src.descriptionSnapshot,
      unitOfMeasureSnapshot: src.unitOfMeasureSnapshot,
      expectedUnitPrice: src.expectedUnitPrice,
      listPriceSnapshot: src.listPriceSnapshot,
      pricingSourceSnapshot: src.pricingSourceSnapshot,
      priceBookIdSnapshot: src.priceBookIdSnapshot,
      priceBookNameSnapshot: src.priceBookNameSnapshot,
      priceBookEntryIdSnapshot: src.priceBookEntryIdSnapshot,
      pricingAsOfDateSnapshot: src.pricingAsOfDateSnapshot,
      discountType: src.discountType,
      discountValue: src.discountValue,
      discountAmount: src.discountAmount,
      taxSnapshot: src.taxSnapshot || {},
      lineSubtotal: src.lineSubtotal,
      lineTaxTotal: src.lineTaxTotal,
      lineTotal: src.lineTotal,
      currencySnapshot: src.currencySnapshot,
      exchangeRateSnapshot: src.exchangeRateSnapshot,
      pricingVersion: src.pricingVersion || CURRENT_DEAL_PRICING_VERSION,
      createdBy: actorId || null,
      modifiedBy: actorId || null
    });
    await copy.save();
    created.push(copy);
  }

  return recalculateDeal({ organizationId, dealId: targetDealId, actorId });
}

function serializeLine(line) {
  if (!line) return null;
  const o = typeof line.toObject === 'function' ? line.toObject() : { ...line };
  return {
    _id: o._id,
    dealLineId: o.dealLineId,
    dealId: o.dealId,
    lineType: o.lineType,
    lineOrder: o.lineOrder,
    itemId: o.itemId,
    variantId: o.variantId,
    quantity: o.quantity,
    skuSnapshot: o.skuSnapshot,
    nameSnapshot: o.nameSnapshot,
    descriptionSnapshot: o.descriptionSnapshot,
    unitOfMeasureSnapshot: o.unitOfMeasureSnapshot,
    expectedUnitPrice: o.expectedUnitPrice,
    listPriceSnapshot: o.listPriceSnapshot,
    pricingSourceSnapshot: o.pricingSourceSnapshot,
    priceBookIdSnapshot: o.priceBookIdSnapshot,
    priceBookNameSnapshot: o.priceBookNameSnapshot,
    discountType: o.discountType,
    discountValue: o.discountValue,
    discountAmount: o.discountAmount,
    taxSnapshot: o.taxSnapshot,
    lineSubtotal: o.lineSubtotal,
    lineTaxTotal: o.lineTaxTotal,
    lineTotal: o.lineTotal,
    currencySnapshot: o.currencySnapshot,
    pricingVersion: o.pricingVersion,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

module.exports = {
  recalculateDeal,
  setAmountMode,
  setManualAmount,
  addLine,
  updateLine,
  removeLine,
  reorderLines,
  softDeleteLinesForDeal,
  restoreLinesForDeal,
  cloneLinesForDeal,
  listActiveLines,
  computeGrandTotalFromLines,
  serializeLine,
  computeDiscountAmount,
  computeLineTotals,
  toCalcLine
};
