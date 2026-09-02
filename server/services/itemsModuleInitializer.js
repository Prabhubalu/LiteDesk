'use strict';

const ModuleDefinition = require('../models/ModuleDefinition');

/**
 * Ensures org-scoped Items module definition exists (retail, automotive verticals).
 */
async function initializeItems(organizationId) {
  const existing = await ModuleDefinition.findOne({
    organizationId,
    $or: [{ moduleKey: 'items' }, { key: 'items' }],
  });

  if (existing) {
    return { skipped: true, reason: 'exists' };
  }

  const platform = await ModuleDefinition.findOne({
    organizationId: null,
    $or: [{ moduleKey: 'items' }, { key: 'items' }],
  }).lean();

  if (!platform) {
    return { skipped: true, reason: 'platform_items_missing' };
  }

  const payload = { ...platform };
  delete payload._id;
  delete payload.createdAt;
  delete payload.updatedAt;
  payload.organizationId = organizationId;
  payload.moduleKey = 'items';
  payload.key = 'items';
  payload.enabled = true;

  await ModuleDefinition.create(payload);
  return { created: true };
}

async function isItemsInitialized(organizationId) {
  const doc = await ModuleDefinition.findOne({
    organizationId,
    $or: [{ moduleKey: 'items' }, { key: 'items' }],
  }).lean();
  return Boolean(doc);
}

module.exports = {
  initializeItems,
  isItemsInitialized,
};
