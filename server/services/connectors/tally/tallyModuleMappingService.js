'use strict';

const TallyModuleMapping = require('../../../models/TallyModuleMapping');
const TallyTaxMapping = require('../../../models/TallyTaxMapping');
const ConnectorFieldMapping = require('../../../models/ConnectorFieldMapping');
const ConnectorExternalObject = require('../../../models/ConnectorExternalObject');
const OrganizationSubscription = require('../../../models/OrganizationSubscription');
const tallyConnectionService = require('./tallyConnectionService');
const {
  DEFAULT_MODULE_MAPPINGS,
  ARIVU_MODULE_OPTIONS,
  TALLY_SYNC_WAYS,
} = require('../../../constants/tallyModuleMappingDefaults');
const { TALLY_DEFAULT_SETTINGS } = require('../../../constants/tallyAddonConstants');
const { CONNECTOR_KEYS } = require('../connectorConstants');
const { ADDON_KEYS } = require('../../../constants/addonKeys');
const { findAddonSubscriptionEntry } = require('../../../utils/addonAccessUtils');
const { DEFAULT_FIELD_MAP_RULES } = require('./tallyDefaultFieldMapRules');

async function getTallyAddonInstalledBy(organizationId) {
  const subscription = await OrganizationSubscription.findOne({ organizationId })
    .select('addonSubscriptions')
    .lean();
  const entry = findAddonSubscriptionEntry(subscription, ADDON_KEYS.TALLY);
  return entry?.installedBy ? String(entry.installedBy) : null;
}

/**
 * Owner for Arivu records created from Tally.
 * Prefer settings.defaultOwnerUserId, else addon installedBy, else preferredUserId.
 */
async function resolveTallyOwnerUserId(organizationId, preferredUserId = null) {
  const settings = await getMergedSettings(organizationId);
  if (settings.defaultOwnerUserId) return String(settings.defaultOwnerUserId);
  const installedBy = await getTallyAddonInstalledBy(organizationId);
  if (installedBy) return installedBy;
  if (preferredUserId) return String(preferredUserId);
  return null;
}

/** Persist installer as default owner once (idempotent). */
async function ensureDefaultOwnerUserId(organizationId, fallbackUserId = null) {
  const connection = await tallyConnectionService.getConnection(organizationId);
  if (!connection) {
    return resolveTallyOwnerUserId(organizationId, fallbackUserId);
  }
  const current = connection.metadata?.settings?.defaultOwnerUserId;
  if (current) return String(current);

  const ownerId =
    (await getTallyAddonInstalledBy(organizationId)) ||
    (fallbackUserId ? String(fallbackUserId) : null);
  if (!ownerId) return null;

  const next = { ...(connection.metadata?.settings || {}), defaultOwnerUserId: ownerId };
  connection.metadata = { ...(connection.metadata || {}), settings: next };
  connection.markModified('metadata');
  await connection.save();
  return ownerId;
}

async function getMergedSettings(organizationId) {
  const connection = await tallyConnectionService.getConnection(organizationId);
  return {
    ...TALLY_DEFAULT_SETTINGS,
    ...(connection?.metadata?.settings || {}),
  };
}

async function patchSettings(organizationId, patch = {}) {
  const connection = await tallyConnectionService.getConnection(organizationId);
  if (!connection) {
    const err = new Error('No Tally connection');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const next = { ...(connection.metadata?.settings || {}) };
  const boolKeys = [
    'autoOutboxFanOutToAllLinkedCompanies',
    'migrationMode',
    'preventProductTaxUpdate',
    'dryRunDefault',
    'scheduledSyncEnabled',
  ];
  for (const key of boolKeys) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key];
  }
  if (patch.recordsPerSyncCycle != null) {
    const n = parseInt(patch.recordsPerSyncCycle, 10);
    const min = TALLY_DEFAULT_SETTINGS.recordsPerSyncCycleMin;
    const max = TALLY_DEFAULT_SETTINGS.recordsPerSyncCycleMax;
    if (!Number.isFinite(n) || n < min || n > max) {
      const err = new Error(`recordsPerSyncCycle must be between ${min} and ${max}`);
      err.code = 'VALIDATION';
      throw err;
    }
    next.recordsPerSyncCycle = n;
  }
  if (patch.syncIntervalMinutes != null) {
    const n = parseInt(patch.syncIntervalMinutes, 10);
    if (!Number.isFinite(n) || n < 1 || n > 1440) {
      const err = new Error('syncIntervalMinutes must be 1–1440');
      err.code = 'VALIDATION';
      throw err;
    }
    next.syncIntervalMinutes = n;
  }
  if (patch.defaultOwnerUserId !== undefined) {
    const raw = patch.defaultOwnerUserId;
    if (raw === null || raw === '') {
      next.defaultOwnerUserId = null;
    } else {
      next.defaultOwnerUserId = String(raw);
    }
  }
  connection.metadata = { ...(connection.metadata || {}), settings: next };
  connection.markModified('metadata');
  await connection.save();
  return getMergedSettings(organizationId);
}

async function ensureModuleMappings({ organizationId, companyGuid = null } = {}) {
  if (!organizationId) throw new Error('organizationId required');
  const existing = await TallyModuleMapping.find({
    organizationId,
    companyGuid: companyGuid || null,
  }).lean();
  const byKey = new Map(existing.map((r) => [r.tallyModuleKey, r]));
  const created = [];

  for (const def of DEFAULT_MODULE_MAPPINGS) {
    if (byKey.has(def.tallyModuleKey)) continue;
    // eslint-disable-next-line no-await-in-loop
    const row = await TallyModuleMapping.create({
      organizationId,
      companyGuid: companyGuid || null,
      tallyModuleKey: def.tallyModuleKey,
      tallyModuleName: def.tallyModuleName,
      arivuModuleKey: def.arivuModuleKey,
      arivuModuleName: def.arivuModuleName,
      entityType: def.entityType,
      syncWay: def.syncWay,
      inboundCreatePolicy: def.inboundCreatePolicy || 'review_only',
      filter: { ...(def.filter || {}) },
      syncOrder: def.syncOrder ?? 50,
      referenceOnly: Boolean(def.referenceOnly),
      discoverOnly: Boolean(def.discoverOnly),
      enabled: def.syncWay !== 'disabled',
    });
    created.push(row);
    byKey.set(def.tallyModuleKey, row);
  }

  const rows = await TallyModuleMapping.find({
    organizationId,
    companyGuid: companyGuid || null,
  })
    .sort({ syncOrder: 1, tallyModuleName: 1 })
    .lean();

  return { rows, createdCount: created.length };
}

async function listModuleMappings({ organizationId, companyGuid = null } = {}) {
  await ensureModuleMappings({ organizationId, companyGuid });
  const settings = await getMergedSettings(organizationId);
  const rows = await TallyModuleMapping.find({
    organizationId,
    companyGuid: companyGuid || null,
  })
    .sort({ syncOrder: 1, tallyModuleName: 1 })
    .lean();
  return {
    rows,
    syncWays: TALLY_SYNC_WAYS,
    arivuModuleOptions: ARIVU_MODULE_OPTIONS,
    settings: {
      migrationMode: Boolean(settings.migrationMode),
      recordsPerSyncCycle: settings.recordsPerSyncCycle ?? 200,
      preventProductTaxUpdate: Boolean(settings.preventProductTaxUpdate),
      dryRunDefault: settings.dryRunDefault !== false,
      scheduledSyncEnabled: Boolean(settings.scheduledSyncEnabled),
      syncIntervalMinutes: settings.syncIntervalMinutes ?? 5,
      defaultOwnerUserId: settings.defaultOwnerUserId || null,
      autoOutboxFanOutToAllLinkedCompanies: settings.autoOutboxFanOutToAllLinkedCompanies !== false,
    },
  };
}

async function updateModuleMapping({
  organizationId,
  companyGuid = null,
  tallyModuleKey,
  patch = {},
} = {}) {
  await ensureModuleMappings({ organizationId, companyGuid });
  const row = await TallyModuleMapping.findOne({
    organizationId,
    companyGuid: companyGuid || null,
    tallyModuleKey: String(tallyModuleKey || '').toLowerCase(),
  });
  if (!row) {
    const err = new Error('Module mapping not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (row.discoverOnly && patch.syncWay && patch.syncWay !== 'disabled' && !patch.arivuModuleKey) {
    const err = new Error('Discover-only modules need an Arivu module before enabling sync');
    err.code = 'VALIDATION';
    throw err;
  }
  if (patch.syncWay != null) {
    if (!TALLY_SYNC_WAYS.includes(patch.syncWay)) {
      const err = new Error(`syncWay must be one of: ${TALLY_SYNC_WAYS.join(', ')}`);
      err.code = 'VALIDATION';
      throw err;
    }
    row.syncWay = patch.syncWay;
    row.enabled = patch.syncWay !== 'disabled';
  }
  if (patch.arivuModuleKey !== undefined) {
    row.arivuModuleKey = patch.arivuModuleKey || null;
    const opt = ARIVU_MODULE_OPTIONS.find((o) => o.key === patch.arivuModuleKey);
    row.arivuModuleName = opt?.label || patch.arivuModuleName || '—';
    // Selecting a real Arivu module clears reference-only lock
    if (patch.arivuModuleKey) {
      row.referenceOnly = false;
      row.discoverOnly = false;
    }
  }
  if (patch.arivuModuleName != null) row.arivuModuleName = patch.arivuModuleName;
  if (patch.filter && typeof patch.filter === 'object') {
    row.filter = { ...(row.filter || {}), ...patch.filter };
  }
  if (patch.syncFrom !== undefined) {
    row.syncFrom = patch.syncFrom ? new Date(patch.syncFrom) : null;
  }
  if (typeof patch.enabled === 'boolean') row.enabled = patch.enabled;
  if (patch.inboundCreatePolicy != null) {
    const { INBOUND_CREATE_POLICIES } = require('../../../constants/atipConstants');
    if (!INBOUND_CREATE_POLICIES.includes(patch.inboundCreatePolicy)) {
      const err = new Error(`inboundCreatePolicy must be one of: ${INBOUND_CREATE_POLICIES.join(', ')}`);
      err.code = 'VALIDATION';
      throw err;
    }
    row.inboundCreatePolicy = patch.inboundCreatePolicy;
  }
  await row.save();
  return row.toObject();
}

async function bulkUpdateModuleMappings({ organizationId, companyGuid = null, rows = [] } = {}) {
  const updated = [];
  for (const r of rows) {
    // eslint-disable-next-line no-await-in-loop
    const row = await updateModuleMapping({
      organizationId,
      companyGuid,
      tallyModuleKey: r.tallyModuleKey,
      patch: r,
    });
    updated.push(row);
  }
  return updated;
}

async function seedDefaultFieldMaps({ organizationId, companyGuid = null } = {}) {
  const results = [];
  for (const [entityType, rules] of Object.entries(DEFAULT_FIELD_MAP_RULES)) {
    // eslint-disable-next-line no-await-in-loop
    let doc = await ConnectorFieldMapping.findOne({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType,
      companyGuid: companyGuid || null,
      active: true,
    });
    if (!doc) {
      // eslint-disable-next-line no-await-in-loop
      doc = await ConnectorFieldMapping.create({
        organizationId,
        connectorKey: CONNECTOR_KEYS.TALLY,
        entityType,
        companyGuid: companyGuid || null,
        rules: rules.map((rule) => ({ ...rule, approved: true, confidence: 1 })),
        active: true,
        version: 1,
      });
      results.push({ entityType, created: true });
    } else if (!doc.rules?.length) {
      doc.rules = rules.map((rule) => ({ ...rule, approved: true, confidence: 1 }));
      // eslint-disable-next-line no-await-in-loop
      await doc.save();
      results.push({ entityType, seeded: true });
    } else {
      results.push({ entityType, exists: true });
    }
  }
  return results;
}

async function listTaxMappings({ organizationId, companyGuid = null } = {}) {
  return TallyTaxMapping.find({
    organizationId,
    companyGuid: companyGuid || null,
    active: true,
  })
    .sort({ tallyLedgerName: 1 })
    .lean();
}

async function upsertTaxMapping({ organizationId, companyGuid = null, mapping } = {}) {
  if (!mapping?.tallyLedgerName) {
    const err = new Error('tallyLedgerName required');
    err.code = 'VALIDATION';
    throw err;
  }
  const row = await TallyTaxMapping.findOneAndUpdate(
    {
      organizationId,
      companyGuid: companyGuid || null,
      tallyLedgerName: mapping.tallyLedgerName,
    },
    {
      $set: {
        tallyDutyHead: mapping.tallyDutyHead || null,
        arivuTaxCode: mapping.arivuTaxCode || null,
        arivuTaxRatePercent:
          mapping.arivuTaxRatePercent != null ? Number(mapping.arivuTaxRatePercent) : null,
        arivuTaxId: mapping.arivuTaxId || null,
        active: mapping.active !== false,
        metadata: mapping.metadata || {},
      },
      $setOnInsert: {
        organizationId,
        companyGuid: companyGuid || null,
        tallyLedgerName: mapping.tallyLedgerName,
      },
    },
    { upsert: true, new: true }
  ).lean();
  return row;
}

async function deleteTaxMapping({ organizationId, companyGuid = null, id } = {}) {
  await TallyTaxMapping.deleteOne({
    _id: id,
    organizationId,
    companyGuid: companyGuid || null,
  });
  return { deleted: true };
}

async function resetModule({ organizationId, companyGuid = null, tallyModuleKey } = {}) {
  const key = String(tallyModuleKey || '').toLowerCase();
  const mapping = await TallyModuleMapping.findOne({
    organizationId,
    companyGuid: companyGuid || null,
    tallyModuleKey: key,
  });
  if (!mapping) {
    const err = new Error('Module mapping not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const entityType = mapping.entityType;
  const def = DEFAULT_MODULE_MAPPINGS.find((d) => d.tallyModuleKey === key);
  mapping.syncWay = def?.syncWay || 'disabled';
  mapping.filter = { ...(def?.filter || {}) };
  mapping.syncFrom = null;
  mapping.watermark = {};
  mapping.lastAlterId = null;
  mapping.lastSyncAt = null;
  mapping.arivuModuleKey = def?.arivuModuleKey ?? null;
  mapping.arivuModuleName = def?.arivuModuleName || '—';
  mapping.enabled = mapping.syncWay !== 'disabled';
  await mapping.save();

  if (entityType) {
    await ConnectorFieldMapping.deleteMany({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType,
      companyGuid: companyGuid || null,
    });
    await ConnectorExternalObject.deleteMany({
      organizationId,
      connectorKey: CONNECTOR_KEYS.TALLY,
      entityType,
      ...(companyGuid ? { companyGuid } : {}),
    });
  }
  await seedDefaultFieldMaps({ organizationId, companyGuid });
  return { reset: true, tallyModuleKey: key };
}

async function resetFullConfiguration({ organizationId, companyGuid = null } = {}) {
  await TallyModuleMapping.deleteMany({
    organizationId,
    companyGuid: companyGuid || null,
  });
  await ConnectorFieldMapping.deleteMany({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    ...(companyGuid ? { companyGuid } : {}),
  });
  await TallyTaxMapping.deleteMany({
    organizationId,
    companyGuid: companyGuid || null,
  });
  await ConnectorExternalObject.deleteMany({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
    ...(companyGuid ? { companyGuid } : {}),
  });

  const connection = await tallyConnectionService.getConnection(organizationId);
  if (connection) {
    const settings = { ...(connection.metadata?.settings || {}) };
    delete settings.salesAccountLedger;
    delete settings.purchaseAccountLedger;
    delete settings.taxMappings;
    delete settings.chargesMappings;
    delete settings.discountMappings;
    connection.metadata = { ...(connection.metadata || {}), settings };
    connection.markModified('metadata');
    await connection.save();
  }

  await ensureModuleMappings({ organizationId, companyGuid });
  await seedDefaultFieldMaps({ organizationId, companyGuid });
  return { reset: true, scope: 'full' };
}

function allowsPull(syncWay) {
  return syncWay === 'tally_to_arivu' || syncWay === 'bidirectional';
}

function allowsPush(syncWay) {
  return syncWay === 'arivu_to_tally' || syncWay === 'bidirectional';
}

module.exports = {
  getMergedSettings,
  patchSettings,
  getTallyAddonInstalledBy,
  resolveTallyOwnerUserId,
  ensureDefaultOwnerUserId,
  ensureModuleMappings,
  listModuleMappings,
  updateModuleMapping,
  bulkUpdateModuleMappings,
  seedDefaultFieldMaps,
  listTaxMappings,
  upsertTaxMapping,
  deleteTaxMapping,
  resetModule,
  resetFullConfiguration,
  allowsPull,
  allowsPush,
  ARIVU_MODULE_OPTIONS,
  TALLY_SYNC_WAYS,
};
