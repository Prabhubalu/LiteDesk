'use strict';

/**
 * Apply ConnectorConflict resolutions to Arivu records and/or Tally outbox.
 * Convention: leftSnapshot = Arivu, rightSnapshot = Tally/external.
 */

const mongoose = require('mongoose');
const Organization = require('../../../models/Organization');
const ItemVariant = require('../../../models/ItemVariant');
const InventoryLocation = require('../../../models/InventoryLocation');
const ConnectorConflict = require('../../../models/ConnectorConflict');
const {
  CONNECTOR_KEYS,
  CONNECTOR_ENTITY_TYPES,
  CONFLICT_RESOLUTIONS,
  CONFLICT_STATUSES,
} = require('../connectorConstants');
const { enqueueAfterItemVariantSave, enqueueAfterPartySave } = require('./tallyOutboxHooks');

const PARTY_FIELDS = ['name', 'gstin', 'phone', 'website', 'taxId', 'address', 'email'];
const ITEM_FIELDS = [
  'variant_code',
  'selling_price',
  'cost_price',
  'barcode',
  'hsnSac',
  'gstRatePercent',
  'unit_of_measure',
];
const GODOWN_FIELDS = ['name', 'description', 'locationCode'];

function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string' && !value.trim()) return true;
  return false;
}

function pickPatch(source, fields, { onlyFillEmpty = false, target = null } = {}) {
  const patch = {};
  if (!source || typeof source !== 'object') return patch;
  for (const key of fields) {
    if (!(key in source)) continue;
    const next = source[key];
    if (isEmpty(next)) continue;
    if (onlyFillEmpty && target && !isEmpty(target[key])) continue;
    patch[key] = next;
  }
  return patch;
}

function normalizeEntityType(entityType) {
  const et = String(entityType || '').toLowerCase();
  if (et === 'ledger') return CONNECTOR_ENTITY_TYPES.PARTY;
  return et;
}

async function loadArivuRecord(entityType, arivuId, organizationId) {
  if (!arivuId || !mongoose.Types.ObjectId.isValid(String(arivuId))) return null;
  const et = normalizeEntityType(entityType);
  if (et === CONNECTOR_ENTITY_TYPES.PARTY || et === 'party') {
    return Organization.findOne({ _id: arivuId, isTenant: false });
  }
  if (et === CONNECTOR_ENTITY_TYPES.ITEM || et === 'item') {
    return ItemVariant.findOne({ _id: arivuId, organizationId });
  }
  if (et === 'godown') {
    return InventoryLocation.findOne({ _id: arivuId, organizationId });
  }
  return null;
}

function fieldsFor(entityType) {
  const et = normalizeEntityType(entityType);
  if (et === CONNECTOR_ENTITY_TYPES.PARTY || et === 'party') return PARTY_FIELDS;
  if (et === CONNECTOR_ENTITY_TYPES.ITEM || et === 'item') return ITEM_FIELDS;
  if (et === 'godown') return GODOWN_FIELDS;
  return [];
}

async function applyExternalToArivu({ conflict, mode }) {
  const fields = fieldsFor(conflict.entityType);
  if (!fields.length || !conflict.arivuId) {
    return { applied: false, reason: 'unsupported_entity_or_missing_arivu' };
  }
  const doc = await loadArivuRecord(conflict.entityType, conflict.arivuId, conflict.organizationId);
  if (!doc) return { applied: false, reason: 'arivu_not_found' };

  const external = conflict.rightSnapshot || {};
  const patch =
    mode === 'merge'
      ? pickPatch(external, fields, { onlyFillEmpty: true, target: doc })
      : pickPatch(external, fields);

  if (!Object.keys(patch).length) {
    return { applied: false, reason: 'no_fields' };
  }

  Object.assign(doc, patch);
  await doc.save();
  return { applied: true, patch, arivuId: String(doc._id) };
}

async function pushArivuToTally({ conflict }) {
  if (!conflict.arivuId) return { enqueued: false, reason: 'missing_arivu' };
  const et = normalizeEntityType(conflict.entityType);
  const companyGuid = conflict.companyGuid || null;

  if (et === CONNECTOR_ENTITY_TYPES.PARTY || et === 'party') {
    const party = await loadArivuRecord(et, conflict.arivuId, conflict.organizationId);
    if (!party) return { enqueued: false, reason: 'arivu_not_found' };
    const rows = await enqueueAfterPartySave({
      organizationId: conflict.organizationId,
      party,
      companyGuid,
    });
    return { enqueued: rows.length > 0, count: rows.length };
  }

  if (et === CONNECTOR_ENTITY_TYPES.ITEM || et === 'item') {
    const variant = await loadArivuRecord(et, conflict.arivuId, conflict.organizationId);
    if (!variant) return { enqueued: false, reason: 'arivu_not_found' };
    const rows = await enqueueAfterItemVariantSave({
      organizationId: conflict.organizationId,
      variant,
      companyGuid,
    });
    return { enqueued: rows.length > 0, count: rows.length };
  }

  return { enqueued: false, reason: 'unsupported_entity' };
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.conflictId
 * @param {string} params.resolution
 * @param {string|null} [params.resolvedBy]
 * @param {string|null} [params.note]
 */
async function resolveAndApply({
  organizationId,
  conflictId,
  resolution,
  resolvedBy = null,
  note = null,
} = {}) {
  if (!organizationId || !conflictId) {
    const err = new Error('organizationId and conflictId required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!Object.values(CONFLICT_RESOLUTIONS).includes(resolution)) {
    const err = new Error(`Invalid resolution: ${resolution}`);
    err.code = 'VALIDATION';
    throw err;
  }

  const conflict = await ConnectorConflict.findOne({
    _id: conflictId,
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY,
  });
  if (!conflict) {
    const err = new Error('Conflict not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const applyResult = { resolution };
  if (resolution === CONFLICT_RESOLUTIONS.USE_EXTERNAL) {
    applyResult.arivu = await applyExternalToArivu({ conflict, mode: 'replace' });
  } else if (resolution === CONFLICT_RESOLUTIONS.MERGE) {
    applyResult.arivu = await applyExternalToArivu({ conflict, mode: 'merge' });
    applyResult.tally = await pushArivuToTally({ conflict });
  } else if (resolution === CONFLICT_RESOLUTIONS.USE_ARIVU) {
    applyResult.tally = await pushArivuToTally({ conflict });
  }

  const nextStatus =
    resolution === CONFLICT_RESOLUTIONS.IGNORE
      ? CONFLICT_STATUSES.IGNORED
      : CONFLICT_STATUSES.RESOLVED;

  conflict.status = nextStatus;
  conflict.resolution = resolution;
  conflict.resolvedBy = resolvedBy;
  conflict.resolvedAt = new Date();
  conflict.metadata = {
    ...(conflict.metadata || {}),
    resolveNote: note || null,
    applyResult,
  };
  await conflict.save();

  return {
    conflict,
    applyResult,
    status: nextStatus,
  };
}

module.exports = {
  resolveAndApply,
  applyExternalToArivu,
  pushArivuToTally,
  PARTY_FIELDS,
  ITEM_FIELDS,
  GODOWN_FIELDS,
};
