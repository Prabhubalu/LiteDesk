'use strict';

const WebformPublicRegistry = require('../models/WebformPublicRegistry');

async function upsertPublicRegistryEntry({ slug, organizationId, webformId }) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized || !organizationId || !webformId) {
    throw new Error('slug, organizationId, and webformId are required');
  }

  return WebformPublicRegistry.findOneAndUpdate(
    { slug: normalized },
    {
      slug: normalized,
      organizationId,
      webformId,
      enabled: true
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function disablePublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return WebformPublicRegistry.findOneAndUpdate(
    { slug: normalized },
    { $set: { enabled: false } },
    { new: true }
  );
}

async function removePublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return WebformPublicRegistry.deleteOne({ slug: normalized });
}

async function findPublicRegistryEntry(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;
  return WebformPublicRegistry.findOne({ slug: normalized, enabled: true }).lean();
}

module.exports = {
  upsertPublicRegistryEntry,
  disablePublicRegistryEntry,
  removePublicRegistryEntry,
  findPublicRegistryEntry
};
