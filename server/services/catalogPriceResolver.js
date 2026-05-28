const ItemVariant = require('../models/ItemVariant');
const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');
const { getPriceBookById, getDefaultPriceBook } = require('./catalogPriceBookService');
const { selectBestEntry } = require('./catalogPriceBookEntryService');

/**
 * Resolve unit price for a sellable variant.
 * @returns {{ unitPrice, currency, source: 'price_book'|'variant_fallback', priceBookId?, entryId? }}
 */
async function resolve({
  organizationId,
  variantId,
  priceBookId = null,
  quantity = 1,
  asOfDate = null
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

  let book;
  if (priceBookId) {
    book = await getPriceBookById(priceBookId, organizationId);
    if (!book || !book.isActive) {
      const err = new Error('Price book not found or inactive');
      err.code = 'NOT_FOUND';
      throw err;
    }
  } else {
    book = await getDefaultPriceBook(organizationId);
  }

  if (book) {
    const entries = await CatalogPriceBookEntry.find({
      organizationId,
      priceBookId: book._id,
      variantId
    }).lean();

    const match = selectBestEntry(entries, { quantity, asOf });
    if (match) {
      return {
        unitPrice: match.unitPrice,
        currency: match.currency || book.currency || variant.currency || 'USD',
        source: 'price_book',
        priceBookId: book._id,
        priceBookName: book.name,
        entryId: match._id,
        minQty: match.minQty,
        effectiveFrom: match.effectiveFrom,
        effectiveTo: match.effectiveTo
      };
    }
  }

  return {
    unitPrice: variant.selling_price ?? 0,
    currency: variant.currency || book?.currency || 'USD',
    source: 'variant_fallback',
    priceBookId: book?._id || null,
    priceBookName: book?.name || null,
    entryId: null
  };
}

module.exports = {
  resolve
};
