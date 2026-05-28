const CatalogPriceBook = require('../models/CatalogPriceBook');
const CatalogPriceBookEntry = require('../models/CatalogPriceBookEntry');

const DEFAULT_BOOK_NAME = 'Standard';

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

  return CatalogPriceBook.create({
    organizationId,
    name: DEFAULT_BOOK_NAME,
    currency: 'USD',
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

  return CatalogPriceBook.create({
    organizationId,
    name,
    description: payload.description ? String(payload.description).trim() : undefined,
    currency: payload.currency || 'USD',
    isDefault,
    isActive: payload.isActive !== false,
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
  if (payload.currency !== undefined) book.currency = payload.currency;
  if (payload.isActive !== undefined) book.isActive = payload.isActive;

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
