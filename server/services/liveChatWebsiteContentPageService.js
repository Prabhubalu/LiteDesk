const mongoose = require('mongoose');
const LiveChatWebsiteContentPage = require('../models/LiveChatWebsiteContentPage');

function normalizePageKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function mapPageRow(row) {
  if (!row) return null;
  return {
    _id: row._id,
    pageKey: row.pageKey,
    title: row.title,
    body: row.body || '',
    matchPath: row.matchPath || '',
    enabled: row.enabled !== false,
    order: Number(row.order) || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function listWebsiteContentPages(organizationId) {
  const rows = await LiveChatWebsiteContentPage.find({ organizationId })
    .sort({ order: 1, title: 1, createdAt: 1 })
    .lean();
  return rows.map(mapPageRow);
}

async function getWebsiteContentPageById(organizationId, pageId) {
  if (!mongoose.Types.ObjectId.isValid(pageId)) return null;
  const row = await LiveChatWebsiteContentPage.findOne({ _id: pageId, organizationId }).lean();
  return mapPageRow(row);
}

async function createWebsiteContentPage(organizationId, payload) {
  const pageKey = normalizePageKey(payload.pageKey || payload.title);
  if (!pageKey) {
    const err = new Error('pageKey is required');
    err.statusCode = 400;
    throw err;
  }

  const title = String(payload.title || '').trim();
  if (!title) {
    const err = new Error('title is required');
    err.statusCode = 400;
    throw err;
  }

  const existing = await LiveChatWebsiteContentPage.findOne({ organizationId, pageKey }).lean();
  if (existing) {
    const err = new Error('A website content page with this key already exists');
    err.statusCode = 409;
    throw err;
  }

  const row = await LiveChatWebsiteContentPage.create({
    organizationId,
    pageKey,
    title,
    body: String(payload.body || '').trim(),
    matchPath: String(payload.matchPath || '').trim(),
    enabled: payload.enabled !== false,
    order: Number(payload.order) || 0,
  });
  return mapPageRow(row.toObject ? row.toObject() : row);
}

async function updateWebsiteContentPage(organizationId, pageId, payload) {
  const row = await LiveChatWebsiteContentPage.findOne({ _id: pageId, organizationId });
  if (!row) {
    const err = new Error('Website content page not found');
    err.statusCode = 404;
    throw err;
  }

  if (payload.title != null) {
    const title = String(payload.title || '').trim();
    if (!title) {
      const err = new Error('title is required');
      err.statusCode = 400;
      throw err;
    }
    row.title = title;
  }
  if (payload.body != null) row.body = String(payload.body || '').trim();
  if (payload.matchPath != null) row.matchPath = String(payload.matchPath || '').trim();
  if (payload.enabled != null) row.enabled = payload.enabled !== false;
  if (payload.order != null) row.order = Number(payload.order) || 0;

  if (payload.pageKey != null) {
    const pageKey = normalizePageKey(payload.pageKey);
    if (!pageKey) {
      const err = new Error('pageKey is required');
      err.statusCode = 400;
      throw err;
    }
    const duplicate = await LiveChatWebsiteContentPage.findOne({
      organizationId,
      pageKey,
      _id: { $ne: row._id },
    }).lean();
    if (duplicate) {
      const err = new Error('A website content page with this key already exists');
      err.statusCode = 409;
      throw err;
    }
    row.pageKey = pageKey;
  }

  await row.save();
  return mapPageRow(row.toObject ? row.toObject() : row);
}

async function deleteWebsiteContentPage(organizationId, pageId) {
  const result = await LiveChatWebsiteContentPage.deleteOne({ _id: pageId, organizationId });
  if (!result.deletedCount) {
    const err = new Error('Website content page not found');
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  listWebsiteContentPages,
  getWebsiteContentPageById,
  createWebsiteContentPage,
  updateWebsiteContentPage,
  deleteWebsiteContentPage,
};
