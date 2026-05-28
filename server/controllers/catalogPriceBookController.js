const {
  listPriceBooks,
  getPriceBookById,
  ensureDefaultPriceBook,
  createPriceBook,
  updatePriceBook,
  deletePriceBook
} = require('../services/catalogPriceBookService');
const {
  listEntriesForPriceBook,
  listEntriesForVariant,
  createEntry,
  updateEntry,
  deleteEntry
} = require('../services/catalogPriceBookEntryService');
const { resolve: resolveCatalogPrice } = require('../services/catalogPriceResolver');

exports.listPriceBooks = async (req, res) => {
  try {
    await ensureDefaultPriceBook(req.user.organizationId, req.user._id);
    const includeInactive = req.query.includeInactive === 'true';
    const data = await listPriceBooks(req.user.organizationId, { includeInactive });
    res.json({ success: true, data });
  } catch (err) {
    console.error('listPriceBooks error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error listing price books' });
  }
};

exports.createPriceBook = async (req, res) => {
  try {
    const data = await createPriceBook({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createPriceBook error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error creating price book', code: err.code });
  }
};

exports.updatePriceBook = async (req, res) => {
  try {
    const data = await updatePriceBook({
      priceBookId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!data) {
      return res.status(404).json({ success: false, message: 'Price book not found' });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('updatePriceBook error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error updating price book', code: err.code });
  }
};

exports.deletePriceBook = async (req, res) => {
  try {
    const removed = await deletePriceBook({
      priceBookId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Price book not found' });
    }
    res.json({ success: true, message: 'Price book deleted' });
  } catch (err) {
    if (err.code === 'DEFAULT_PROTECTED') {
      return res.status(400).json({ success: false, message: err.message, code: err.code });
    }
    console.error('deletePriceBook error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting price book' });
  }
};

exports.getPriceBookEntries = async (req, res) => {
  try {
    const book = await getPriceBookById(req.params.id, req.user.organizationId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Price book not found' });
    }
    const data = await listEntriesForPriceBook(req.params.id, req.user.organizationId);
    res.json({ success: true, data, priceBook: book });
  } catch (err) {
    console.error('getPriceBookEntries error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching entries' });
  }
};

exports.createPriceBookEntry = async (req, res) => {
  try {
    const data = await createEntry({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      priceBookId: req.params.id,
      payload: req.body || {}
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error('createPriceBookEntry error:', err);
    const status = err.code === 'DUPLICATE_ENTRY' ? 409 : 400;
    res.status(status).json({ success: false, message: err.message || 'Error creating entry', code: err.code });
  }
};

exports.updatePriceBookEntry = async (req, res) => {
  try {
    const data = await updateEntry({
      entryId: req.params.entryId,
      priceBookId: req.params.id,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });
    if (!data) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('updatePriceBookEntry error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error updating entry', code: err.code });
  }
};

exports.deletePriceBookEntry = async (req, res) => {
  try {
    const removed = await deleteEntry({
      entryId: req.params.entryId,
      priceBookId: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }
    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    console.error('deletePriceBookEntry error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting entry' });
  }
};

exports.getVariantPriceEntries = async (req, res) => {
  try {
    const priceBookId = req.query.priceBookId || null;
    const data = await listEntriesForVariant(
      req.params.variantId,
      req.user.organizationId,
      { priceBookId }
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error('getVariantPriceEntries error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error fetching variant prices' });
  }
};

exports.resolveCatalogPrice = async (req, res) => {
  try {
    const { variantId, priceBookId, quantity, asOfDate } = req.body || req.query || {};
    if (!variantId) {
      return res.status(400).json({ success: false, message: 'variantId is required' });
    }
    const data = await resolveCatalogPrice({
      organizationId: req.user.organizationId,
      variantId,
      priceBookId: priceBookId || null,
      quantity: quantity ?? 1,
      asOfDate: asOfDate || null
    });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('resolveCatalogPrice error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error resolving price', code: err.code });
  }
};
