const mongoose = require('mongoose');
const Item = require('../models/Item');
const {
  listItemMedia,
  addItemMediaFromUpload,
  addItemMediaFromUrl,
  updateItemMedia,
  deleteItemMedia,
  sortMediaEntries,
  seedMediaFromProductImage
} = require('../services/itemMediaService');
const {
  listItemVariants,
  ensureDefaultVariant,
  createItemVariant,
  updateItemVariant,
  refreshItemVariantLinkage
} = require('../services/itemVariantService');

async function loadOwnedItem(req) {
  const itemId = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return { error: { status: 400, message: 'Invalid item id' } };
  }
  const item = await Item.findOne({
    _id: itemId,
    organizationId: req.user.organizationId,
    deletedAt: null
  });
  if (!item) {
    return { error: { status: 404, message: 'Item not found or access denied' } };
  }
  return { item };
}

// @desc    List item media gallery
// @route   GET /api/items/:id/media
exports.getItemMedia = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await seedMediaFromProductImage(item, req.user._id);
    const media = await listItemMedia(item._id, req.user.organizationId);
    res.json({ success: true, data: media });
  } catch (err) {
    console.error('getItemMedia error:', err);
    res.status(500).json({ success: false, message: 'Error fetching item media', error: err.message });
  }
};

// @desc    Upload or register media
// @route   POST /api/items/:id/media
exports.addItemMedia = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    let entry;
    if (req.file) {
      entry = await addItemMediaFromUpload({
        itemId: item._id,
        organizationId: req.user.organizationId,
        userId: req.user._id,
        file: req.file,
        req,
        altText: req.body?.altText,
        kind: req.body?.kind,
        isPrimary: req.body?.isPrimary === 'true' || req.body?.isPrimary === true
      });
    } else if (req.body?.url) {
      entry = await addItemMediaFromUrl({
        itemId: item._id,
        organizationId: req.user.organizationId,
        userId: req.user._id,
        url: req.body.url,
        altText: req.body.altText,
        kind: req.body.kind,
        isPrimary: req.body.isPrimary === true
      });
    } else {
      return res.status(400).json({ success: false, message: 'File or url is required' });
    }

    const media = await listItemMedia(item._id, req.user.organizationId);
    res.status(201).json({ success: true, data: entry, media: sortMediaEntries(media) });
  } catch (err) {
    console.error('addItemMedia error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error adding item media' });
  }
};

// @desc    Update media entry (primary, alt, order)
// @route   PATCH /api/items/:id/media/:mediaId
exports.patchItemMedia = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const entry = await updateItemMedia({
      itemId: item._id,
      mediaId: req.params.mediaId,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      updates: req.body || {}
    });

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Media entry not found' });
    }

    res.json({ success: true, data: entry });
  } catch (err) {
    console.error('patchItemMedia error:', err);
    res.status(500).json({ success: false, message: 'Error updating item media', error: err.message });
  }
};

// @desc    Delete media entry
// @route   DELETE /api/items/:id/media/:mediaId
exports.deleteItemMedia = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const removed = await deleteItemMedia({
      itemId: item._id,
      mediaId: req.params.mediaId,
      organizationId: req.user.organizationId,
      userId: req.user._id
    });

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Media entry not found' });
    }

    res.json({ success: true, message: 'Media removed', data: removed });
  } catch (err) {
    console.error('deleteItemMedia error:', err);
    res.status(500).json({ success: false, message: 'Error deleting item media', error: err.message });
  }
};

// @desc    List item variants (scaffold)
// @route   GET /api/items/:id/variants
exports.getItemVariants = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await ensureDefaultVariant(item, req.user._id);
    const variants = await listItemVariants(item._id, req.user.organizationId);
    res.json({ success: true, data: variants });
  } catch (err) {
    console.error('getItemVariants error:', err);
    res.status(500).json({ success: false, message: 'Error fetching item variants', error: err.message });
  }
};

// @desc    Create additional variant (scaffold)
// @route   POST /api/items/:id/variants
exports.createItemVariant = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const variant = await createItemVariant({
      item,
      userId: req.user._id,
      payload: req.body || {}
    });

    await refreshItemVariantLinkage(item._id, req.user.organizationId);

    res.status(201).json({ success: true, data: variant });
  } catch (err) {
    if (err.code === 'BARCODE_CONFLICT') {
      return res.status(409).json({ success: false, message: err.message, code: err.code });
    }
    console.error('createItemVariant error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error creating variant' });
  }
};

// @desc    Update variant (barcode / QR scaffold)
// @route   PUT /api/items/:id/variants/:variantId
exports.updateItemVariant = async (req, res) => {
  try {
    const { item, error } = await loadOwnedItem(req);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const variant = await updateItemVariant({
      variantId: req.params.variantId,
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {}
    });

    if (!variant || String(variant.itemId) !== String(item._id)) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    res.json({ success: true, data: variant });
  } catch (err) {
    if (err.code === 'BARCODE_CONFLICT') {
      return res.status(409).json({ success: false, message: err.message, code: err.code });
    }
    console.error('updateItemVariant error:', err);
    res.status(400).json({ success: false, message: err.message || 'Error updating variant' });
  }
};
