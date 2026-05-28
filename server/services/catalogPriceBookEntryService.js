const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');
const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const { getPriceBookById } = require('./catalogPriceBookService');

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function entryIsEffective(entry, asOf) {
  const from = entry.effectiveFrom ? new Date(entry.effectiveFrom) : null;
  const to = entry.effectiveTo ? new Date(entry.effectiveTo) : null;
  if (from && asOf < from) return false;
  if (to && asOf > to) return false;
  return true;
}

async function enrichPriceBookEntries(organizationId, rows) {
  if (!rows.length) return [];

  const variantIds = [...new Set(rows.map((r) => String(r.variantId)))];
  const variants = await ItemVariant.find({
    organizationId,
    _id: { $in: variantIds }
  }).lean();
  const variantById = new Map(variants.map((v) => [String(v._id), v]));

  const itemIds = [...new Set(variants.map((v) => String(v.itemId)))];
  const items = await Item.find({
    organizationId,
    _id: { $in: itemIds },
    deletedAt: null
  })
    .select('item_name item_code')
    .lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  return rows.map((row) => {
    const variant = variantById.get(String(row.variantId));
    const item = variant ? itemById.get(String(variant.itemId)) : null;
    return {
      ...row,
      variant_code: variant?.variant_code || null,
      item_id: variant?.itemId || null,
      parentItemId: variant?.itemId || null,
      item_name: item?.item_name || null,
      item_code: item?.item_code || null
    };
  });
}

async function listEntriesForPriceBook(priceBookId, organizationId) {
  const rows = await CatalogPriceBookEntry.find({ organizationId, priceBookId })
    .sort({ variantId: 1, minQty: -1, effectiveFrom: -1 })
    .lean();
  return enrichPriceBookEntries(organizationId, rows);
}

async function listEntriesForVariant(variantId, organizationId, { priceBookId } = {}) {
  const query = { organizationId, variantId };
  if (priceBookId) query.priceBookId = priceBookId;
  return CatalogPriceBookEntry.find(query)
    .sort({ priceBookId: 1, minQty: -1, effectiveFrom: -1 })
    .lean();
}

async function createEntry({ organizationId, userId, priceBookId, payload }) {
  const book = await getPriceBookById(priceBookId, organizationId);
  if (!book) {
    const err = new Error('Price book not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const variantId = payload.variantId;
  if (!variantId) {
    const err = new Error('variantId is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const variant = await ItemVariant.findOne({ _id: variantId, organizationId }).select('_id').lean();
  if (!variant) {
    const err = new Error('Variant not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const unitPrice = Number(payload.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    const err = new Error('unitPrice must be a non-negative number');
    err.code = 'VALIDATION';
    throw err;
  }

  const minQty = Math.max(1, Number(payload.minQty) || 1);
  const effectiveFrom = parseDate(payload.effectiveFrom);
  const effectiveTo = parseDate(payload.effectiveTo);

  const duplicate = await CatalogPriceBookEntry.findOne({
    organizationId,
    priceBookId,
    variantId,
    minQty,
    effectiveFrom: effectiveFrom || null,
    effectiveTo: effectiveTo || null
  }).lean();
  if (duplicate) {
    const err = new Error('A price entry with the same quantity tier already exists for this variant');
    err.code = 'DUPLICATE_ENTRY';
    throw err;
  }

  return CatalogPriceBookEntry.create({
    organizationId,
    priceBookId,
    variantId,
    unitPrice,
    currency: payload.currency || book.currency || 'USD',
    effectiveFrom,
    effectiveTo,
    minQty,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updateEntry({ entryId, priceBookId, organizationId, userId, payload }) {
  const entry = await CatalogPriceBookEntry.findOne({
    _id: entryId,
    priceBookId,
    organizationId
  });
  if (!entry) return null;

  if (payload.unitPrice !== undefined) {
    const unitPrice = Number(payload.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const err = new Error('unitPrice must be a non-negative number');
      err.code = 'VALIDATION';
      throw err;
    }
    entry.unitPrice = unitPrice;
  }
  if (payload.currency !== undefined) entry.currency = payload.currency;
  if (payload.effectiveFrom !== undefined) entry.effectiveFrom = parseDate(payload.effectiveFrom);
  if (payload.effectiveTo !== undefined) entry.effectiveTo = parseDate(payload.effectiveTo);
  if (payload.minQty !== undefined) entry.minQty = Math.max(1, Number(payload.minQty) || 1);

  entry.modifiedBy = userId;
  await entry.save();
  return entry;
}

async function deleteEntry({ entryId, priceBookId, organizationId }) {
  const entry = await CatalogPriceBookEntry.findOneAndDelete({
    _id: entryId,
    priceBookId,
    organizationId
  });
  return entry;
}

/**
 * Pick best matching entry for variant + quantity at asOf date.
 */
function selectBestEntry(entries, { quantity = 1, asOf = new Date() }) {
  const qty = Math.max(1, Number(quantity) || 1);
  const candidates = entries
    .filter((e) => entryIsEffective(e, asOf))
    .filter((e) => (e.minQty || 1) <= qty);

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const minDiff = (b.minQty || 1) - (a.minQty || 1);
    if (minDiff !== 0) return minDiff;
    const aFrom = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
    const bFrom = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
    return bFrom - aFrom;
  });

  return candidates[0];
}

module.exports = {
  listEntriesForPriceBook,
  listEntriesForVariant,
  createEntry,
  updateEntry,
  deleteEntry,
  selectBestEntry,
  entryIsEffective
};
