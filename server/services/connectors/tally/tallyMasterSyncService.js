'use strict';

const crypto = require('crypto');
const Organization = require('../../../models/Organization');
const Item = require('../../../models/Item');
const ItemVariant = require('../../../models/ItemVariant');
const InventoryLocation = require('../../../models/InventoryLocation');
const CatalogCategory = require('../../../models/CatalogCategory');
const { CONNECTOR_KEYS, CONNECTOR_ENTITY_TYPES, CONNECTOR_DIRECTIONS } = require('../connectorConstants');
const connectorExternalObjectService = require('../connectorExternalObjectService');
const connectorOutboxService = require('../connectorOutboxService');
const partyMapper = require('./mappers/partyMapper');
const stockItemMapper = require('./mappers/stockItemMapper');
const godownMapper = require('./mappers/godownMapper');
const stockGroupMapper = require('./mappers/stockGroupMapper');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function enqueueMasterSync({
  organizationId,
  entityType,
  arivuId,
  payload,
  companyGuid = null,
  dryRun = false,
}) {
  if (dryRun) {
    return {
      dryRun: true,
      entityType,
      arivuId,
      payload,
      payloadHash: hashPayload(payload),
    };
  }

  const existing = await connectorExternalObjectService.findByArivu({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId,
  });

  const operation = existing ? 'upsert' : 'create';
  const outbox = await connectorOutboxService.enqueueOutbox({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    entityType,
    arivuId,
    operation,
    companyGuid,
    payload,
    idempotencyKey: `tally:${entityType}:${arivuId}:${hashPayload(payload)}`,
    metadata: { source: 'tallyMasterSyncService' },
  });

  if (existing?.externalId) {
    await connectorExternalObjectService.upsertLink({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType,
      externalId: existing.externalId,
      arivuId,
      companyGuid,
      lastDirection: CONNECTOR_DIRECTIONS.OUTBOUND,
      payloadHash: hashPayload(payload),
      metadata: { pendingOutboxId: String(outbox._id) },
    });
  }

  return { dryRun: false, entityType, arivuId, outboxId: String(outbox._id), operation, payload };
}

async function syncParties({
  organizationId,
  companyGuid = null,
  dryRun = false,
  limit = 500,
  partyIds = null,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const query = { isTenant: false };
  if (Organization.schema.path('deletedAt')) query.deletedAt = null;
  if (Array.isArray(partyIds) && partyIds.length) {
    query._id = { $in: partyIds };
  }

  const parties = await Organization.find(query).limit(limit).lean();
  const results = [];

  for (const org of parties) {
    const payload = partyMapper.toTally(org);
    results.push(
      await enqueueMasterSync({
        organizationId,
        entityType: CONNECTOR_ENTITY_TYPES.PARTY,
        arivuId: String(org._id),
        payload,
        companyGuid,
        dryRun,
      })
    );
  }

  return { entityType: CONNECTOR_ENTITY_TYPES.PARTY, count: results.length, dryRun: Boolean(dryRun), results };
}

async function syncStockItems({
  organizationId,
  companyGuid = null,
  dryRun = false,
  limit = 500,
  variantIds = null,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const query = { organizationId };
  if (Array.isArray(variantIds) && variantIds.length) {
    query._id = { $in: variantIds };
  }

  const variants = await ItemVariant.find(query).limit(limit).lean();
  const itemIds = [...new Set(variants.map((v) => String(v.itemId)).filter(Boolean))];
  const items = await Item.find({ organizationId, _id: { $in: itemIds } }).lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  const results = [];
  for (const variant of variants) {
    const item = itemById.get(String(variant.itemId)) || {};
    const payload = stockItemMapper.toTally(variant, item);
    results.push(
      await enqueueMasterSync({
        organizationId,
        entityType: CONNECTOR_ENTITY_TYPES.ITEM,
        arivuId: String(variant._id),
        payload,
        companyGuid,
        dryRun,
      })
    );
  }

  return { entityType: CONNECTOR_ENTITY_TYPES.ITEM, count: results.length, dryRun: Boolean(dryRun), results };
}

async function syncGodowns({
  organizationId,
  companyGuid = null,
  dryRun = false,
  limit = 200,
  locationIds = null,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const query = { organizationId };
  if (Array.isArray(locationIds) && locationIds.length) {
    query._id = { $in: locationIds };
  }

  const locations = await InventoryLocation.find(query).limit(limit).lean();
  const results = [];

  for (const location of locations) {
    const payload = godownMapper.toTally(location);
    results.push(
      await enqueueMasterSync({
        organizationId,
        entityType: CONNECTOR_ENTITY_TYPES.GODOWN,
        arivuId: String(location._id),
        payload,
        companyGuid,
        dryRun,
      })
    );
  }

  return { entityType: CONNECTOR_ENTITY_TYPES.GODOWN, count: results.length, dryRun: Boolean(dryRun), results };
}

async function syncCategories({
  organizationId,
  companyGuid = null,
  dryRun = false,
  limit = 500,
  categoryIds = null,
} = {}) {
  if (!organizationId) throw new Error('organizationId required');

  const query = { organizationId };
  if (Array.isArray(categoryIds) && categoryIds.length) {
    query._id = { $in: categoryIds };
  }

  const categories = await CatalogCategory.find(query).sort({ path: 1 }).limit(limit).lean();
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const results = [];

  for (const category of categories) {
    const parent = category.parentId ? byId.get(String(category.parentId)) || null : null;
    const payload = stockGroupMapper.toTally(category, parent);
    results.push(
      await enqueueMasterSync({
        organizationId,
        entityType: 'stock_group',
        arivuId: String(category._id),
        payload,
        companyGuid,
        dryRun,
      })
    );
  }

  return { entityType: 'stock_group', count: results.length, dryRun: Boolean(dryRun), results };
}

module.exports = {
  syncParties,
  syncStockItems,
  syncGodowns,
  syncCategories,
  enqueueMasterSync,
};
