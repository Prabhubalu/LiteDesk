const CatalogPriceBook = require('../models/CatalogPriceBook');
const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');
const { normalizeCustomerType } = require('../constants/pricingEngine');
const {
  getTenantCurrencyCode,
  resolveCurrencyOrOrgDefault,
} = require('../utils/orgCurrency');

const DEFAULT_BOOK_NAME = 'Standard';

function normalizeCustomerTypes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const ct = normalizeCustomerType(raw);
    if (ct && !out.includes(ct)) out.push(ct);
  }
  return out;
}

function normalizeRegionCodes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const r = String(raw || '').trim().toUpperCase();
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function listPriceBooks(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) {
    query.isActive = true;
  }
  return CatalogPriceBook.find(query).sort({ isDefault: -1, name: 1 }).lean();
}

async function getPriceBookById(priceBookId, organizationId) {
  return CatalogPriceBook.findOne({ _id: priceBookId, organizationId }).lean();
}

async function getDefaultPriceBook(organizationId) {
  let book = await CatalogPriceBook.findOne({ organizationId, isDefault: true, isActive: true }).lean();
  if (book) return book;
  book = await CatalogPriceBook.findOne({ organizationId, isActive: true }).sort({ createdAt: 1 }).lean();
  return book;
}

async function ensureDefaultPriceBook(organizationId, userId) {
  const existing = await CatalogPriceBook.findOne({ organizationId, isDefault: true });
  if (existing) return existing;

  const anyBook = await CatalogPriceBook.findOne({ organizationId });
  if (anyBook) {
    if (!anyBook.isDefault) {
      await CatalogPriceBook.updateMany(
        { organizationId },
        { $set: { isDefault: false } }
      );
      anyBook.isDefault = true;
      anyBook.modifiedBy = userId;
      await anyBook.save();
    }
    return anyBook;
  }

  const currency = await getTenantCurrencyCode(organizationId);
  return CatalogPriceBook.create({
    organizationId,
    name: DEFAULT_BOOK_NAME,
    currency,
    isDefault: true,
    isActive: true,
    createdBy: userId,
    modifiedBy: userId
  });
}

async function createPriceBook({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('Price book name is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const isDefault = payload.isDefault === true;
  if (isDefault) {
    await CatalogPriceBook.updateMany(
      { organizationId },
      { $set: { isDefault: false } }
    );
  }

  const currency = await resolveCurrencyOrOrgDefault(payload.currency, organizationId);

  return CatalogPriceBook.create({
    organizationId,
    name,
    description: payload.description ? String(payload.description).trim() : undefined,
    currency,
    isDefault,
    isActive: payload.isActive !== false,
    customerTypes: normalizeCustomerTypes(payload.customerTypes),
    regionCodes: normalizeRegionCodes(payload.regionCodes),
    priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : 100,
    effectiveFrom: parseOptionalDate(payload.effectiveFrom),
    effectiveUntil: parseOptionalDate(payload.effectiveUntil),
    createdBy: userId,
    modifiedBy: userId
  });
}

async function updatePriceBook({ priceBookId, organizationId, userId, payload }) {
  const book = await CatalogPriceBook.findOne({ _id: priceBookId, organizationId });
  if (!book) return null;

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) {
      const err = new Error('Price book name is required');
      err.code = 'VALIDATION';
      throw err;
    }
    book.name = name;
  }
  if (payload.description !== undefined) book.description = payload.description;
  let currencyChanged = false;
  let nextCurrency = book.currency;
  if (payload.currency !== undefined) {
    nextCurrency = await resolveCurrencyOrOrgDefault(payload.currency, organizationId);
    currencyChanged = String(book.currency || '').toUpperCase() !== String(nextCurrency).toUpperCase();
    book.currency = nextCurrency;
  }
  if (payload.isActive !== undefined) book.isActive = payload.isActive;
  if (payload.customerTypes !== undefined) book.customerTypes = normalizeCustomerTypes(payload.customerTypes);
  if (payload.regionCodes !== undefined) book.regionCodes = normalizeRegionCodes(payload.regionCodes);
  if (payload.priority !== undefined) {
    book.priority = Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : book.priority;
  }
  if (payload.effectiveFrom !== undefined) book.effectiveFrom = parseOptionalDate(payload.effectiveFrom);
  if (payload.effectiveUntil !== undefined) book.effectiveUntil = parseOptionalDate(payload.effectiveUntil);

  if (payload.isDefault === true) {
    await CatalogPriceBook.updateMany(
      { organizationId, _id: { $ne: book._id } },
      { $set: { isDefault: false } }
    );
    book.isDefault = true;
  } else if (payload.isDefault === false && book.isDefault) {
    const err = new Error('Cannot unset the only default price book; set another book as default first');
    err.code = 'DEFAULT_REQUIRED';
    throw err;
  }

  book.modifiedBy = userId;
  await book.save();

  // A price book is single-currency; keep entry currency snapshots in sync.
  if (currencyChanged) {
    await CatalogPriceBookEntry.updateMany(
      { organizationId, priceBookId: book._id },
      { $set: { currency: nextCurrency } }
    );
  }

  return book;
}

async function deletePriceBook({ priceBookId, organizationId }) {
  const book = await CatalogPriceBook.findOne({ _id: priceBookId, organizationId });
  if (!book) return null;

  if (book.isDefault) {
    const err = new Error('Cannot delete the default price book');
    err.code = 'DEFAULT_PROTECTED';
    throw err;
  }

  await CatalogPriceBookEntry.deleteMany({ organizationId, priceBookId: book._id });
  await CatalogPriceBook.deleteOne({ _id: book._id });
  return book;
}

module.exports = {
  DEFAULT_BOOK_NAME,
  listPriceBooks,
  getPriceBookById,
  getDefaultPriceBook,
  ensureDefaultPriceBook,
  createPriceBook,
  updatePriceBook,
  deletePriceBook
};
