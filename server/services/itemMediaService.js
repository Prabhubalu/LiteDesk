const mongoose = require('mongoose');
const Item = require('../models/Item');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const { isCatalogMediaKind } = require('../constants/catalogBarcode');

function sortMediaEntries(media = []) {
  return [...media].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
  });
}

function resolvePrimaryMediaUrl(media = []) {
  const sorted = sortMediaEntries(media);
  const primary = sorted.find((entry) => entry.isPrimary) || sorted.find((entry) => entry.kind === 'image');
  return primary?.url || null;
}

async function syncProductImageFromMedia(itemId, organizationId) {
  const item = await Item.findOne({ _id: itemId, organizationId, deletedAt: null }).select('media product_image');
  if (!item) return null;
  const primaryUrl = resolvePrimaryMediaUrl(item.media || []);
  if (item.product_image !== primaryUrl) {
    item.product_image = primaryUrl || '';
    await item.save();
  }
  return primaryUrl;
}

async function loadItemForCatalog(itemId, organizationId) {
  return Item.findOne({
    _id: itemId,
    organizationId,
    deletedAt: null
  });
}

async function listItemMedia(itemId, organizationId) {
  const item = await loadItemForCatalog(itemId, organizationId);
  if (!item) return null;
  return sortMediaEntries(item.media || []);
}

async function addItemMediaFromUpload({ itemId, organizationId, userId, file, req, altText, kind, isPrimary }) {
  const item = await loadItemForCatalog(itemId, organizationId);
  if (!item) return null;

  const mediaKind = isCatalogMediaKind(kind) ? kind : (file.mimetype?.startsWith('image/') ? 'image' : 'document');
  const uploadResult = await persistMulterUpload(req, 'items');
  const url = uploadResult.url;
  const nextOrder = (item.media || []).length;

  const entry = {
    _id: new mongoose.Types.ObjectId(),
    url,
    kind: mediaKind,
    isPrimary: !!isPrimary || !(item.media || []).length,
    altText: altText || file.originalname || '',
    sortOrder: nextOrder,
    fileName: file.originalname,
    fileType: file.mimetype,
    fileSize: file.size,
    uploadedBy: userId,
    uploadedAt: new Date()
  };

  if (entry.isPrimary) {
    for (const m of item.media || []) {
      m.isPrimary = false;
    }
  }

  item.media = [...(item.media || []), entry];
  item.modifiedBy = userId;
  await item.save();
  await syncProductImageFromMedia(itemId, organizationId);

  const refreshed = await loadItemForCatalog(itemId, organizationId);
  return sortMediaEntries(refreshed?.media || []).find((m) => String(m._id) === String(entry._id));
}

async function addItemMediaFromUrl({ itemId, organizationId, userId, url, altText, kind, isPrimary }) {
  const item = await loadItemForCatalog(itemId, organizationId);
  if (!item) return null;
  if (!url) {
    throw new Error('url is required');
  }

  const mediaKind = isCatalogMediaKind(kind) ? kind : 'image';
  const entry = {
    _id: new mongoose.Types.ObjectId(),
    url: String(url).trim(),
    kind: mediaKind,
    isPrimary: !!isPrimary || !(item.media || []).length,
    altText: altText || '',
    sortOrder: (item.media || []).length,
    uploadedBy: userId,
    uploadedAt: new Date()
  };

  if (entry.isPrimary) {
    for (const m of item.media || []) {
      m.isPrimary = false;
    }
  }

  item.media = [...(item.media || []), entry];
  item.modifiedBy = userId;
  await item.save();
  await syncProductImageFromMedia(itemId, organizationId);

  const refreshed = await loadItemForCatalog(itemId, organizationId);
  return sortMediaEntries(refreshed?.media || []).find((m) => String(m._id) === String(entry._id));
}

async function updateItemMedia({ itemId, mediaId, organizationId, userId, updates }) {
  const item = await loadItemForCatalog(itemId, organizationId);
  if (!item) return null;

  const media = item.media || [];
  const index = media.findIndex((m) => String(m._id) === String(mediaId));
  if (index === -1) return null;

  if (updates.isPrimary === true) {
    media.forEach((m, i) => {
      m.isPrimary = i === index;
    });
  }
  if (typeof updates.altText === 'string') {
    media[index].altText = updates.altText;
  }
  if (typeof updates.sortOrder === 'number') {
    media[index].sortOrder = updates.sortOrder;
  }

  item.media = media;
  item.modifiedBy = userId;
  await item.save();
  await syncProductImageFromMedia(itemId, organizationId);

  return sortMediaEntries(item.media).find((m) => String(m._id) === String(mediaId));
}

async function deleteItemMedia({ itemId, mediaId, organizationId, userId }) {
  const item = await loadItemForCatalog(itemId, organizationId);
  if (!item) return null;

  const before = item.media || [];
  const index = before.findIndex((m) => String(m._id) === String(mediaId));
  if (index === -1) return null;

  const removed = before[index];
  const remaining = before.filter((m) => String(m._id) !== String(mediaId));

  if (removed.isPrimary && remaining.length > 0) {
    const firstImage = remaining.find((m) => m.kind === 'image') || remaining[0];
    if (firstImage) firstImage.isPrimary = true;
  }

  item.media = remaining;
  item.modifiedBy = userId;
  await item.save();
  await syncProductImageFromMedia(itemId, organizationId);

  return removed;
}

async function seedMediaFromProductImage(item, userId) {
  if (!item?.product_image || (item.media && item.media.length > 0)) {
    return item;
  }

  item.media = [{
    _id: new mongoose.Types.ObjectId(),
    url: item.product_image,
    kind: 'image',
    isPrimary: true,
    altText: item.item_name || '',
    sortOrder: 0,
    uploadedBy: userId,
    uploadedAt: new Date()
  }];
  await item.save();
  return item;
}

module.exports = {
  sortMediaEntries,
  resolvePrimaryMediaUrl,
  syncProductImageFromMedia,
  listItemMedia,
  addItemMediaFromUpload,
  addItemMediaFromUrl,
  updateItemMedia,
  deleteItemMedia,
  seedMediaFromProductImage
};
