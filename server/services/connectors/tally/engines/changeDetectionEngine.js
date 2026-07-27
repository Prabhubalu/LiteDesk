'use strict';

/**
 * ATIP Change Detection Engine — AlterID/MasterID watermarks, rename/delete detection.
 */

const TallyModuleMapping = require('../../../../models/TallyModuleMapping');
const ConnectorExternalObject = require('../../../../models/ConnectorExternalObject');
const { CONNECTOR_KEYS } = require('../../connectorConstants');

function extractAlterId(record = {}) {
  return (
    record.ALTERID ||
    record.alterId ||
    record.alter_id ||
    record.MASTERID ||
    record.masterId ||
    null
  );
}

function extractGuid(record = {}) {
  return record.GUID || record.guid || record.externalId || record.remoteId || null;
}

function extractName(record = {}) {
  return record.NAME || record.name || record.ledgerName || record.itemName || null;
}

/**
 * Classify records relative to previous watermark / known external objects.
 */
async function detectChanges({
  organizationId,
  companyGuid,
  tallyModuleKey,
  entityType,
  records = [],
}) {
  const mapping = await TallyModuleMapping.findOne({
    organizationId,
    companyGuid,
    tallyModuleKey,
  });

  const lastAlterId = mapping?.lastAlterId || mapping?.watermark?.lastAlterId || null;
  const lastAlterNum = lastAlterId != null && lastAlterId !== '' ? Number(lastAlterId) : null;

  const existing = await ConnectorExternalObject.find({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
    companyGuid,
    entityType: entityType || tallyModuleKey,
  })
    .select('remoteId name metadata status arivuId')
    .lean();

  const byRemote = new Map(existing.map((e) => [String(e.remoteId), e]));
  const seen = new Set();

  const result = {
    created: [],
    updated: [],
    unchanged: [],
    renamed: [],
    deleted: [],
    maxAlterId: lastAlterId,
  };

  for (const rec of records) {
    const guid = extractGuid(rec);
    const alterId = extractAlterId(rec);
    const name = extractName(rec);
    if (guid) seen.add(String(guid));

    const alterNum = alterId != null && alterId !== '' ? Number(alterId) : null;
    if (alterNum != null && !Number.isNaN(alterNum)) {
      const curMax = result.maxAlterId != null ? Number(result.maxAlterId) : null;
      if (curMax == null || alterNum > curMax) result.maxAlterId = String(alterId);
    }

    // Incremental filter: skip if alterId <= watermark (when both numeric)
    if (
      lastAlterNum != null &&
      !Number.isNaN(lastAlterNum) &&
      alterNum != null &&
      !Number.isNaN(alterNum) &&
      alterNum <= lastAlterNum
    ) {
      result.unchanged.push(rec);
      continue;
    }

    const prev = guid ? byRemote.get(String(guid)) : null;
    if (!prev) {
      result.created.push(rec);
      continue;
    }
    if (name && prev.name && String(prev.name) !== String(name)) {
      result.renamed.push({ ...rec, previousName: prev.name });
    } else {
      result.updated.push(rec);
    }
  }

  for (const [remoteId, prev] of byRemote.entries()) {
    if (!seen.has(remoteId) && prev.status !== 'ignored' && prev.status !== 'deleted') {
      result.deleted.push(prev);
    }
  }

  return result;
}

async function advanceWatermark({
  organizationId,
  companyGuid,
  tallyModuleKey,
  lastAlterId = null,
  lastMasterId = null,
  extra = {},
}) {
  const $set = {
    lastSyncAt: new Date(),
    watermark: {
      ...(extra || {}),
      lastAlterId: lastAlterId || undefined,
      lastMasterId: lastMasterId || undefined,
      advancedAt: new Date().toISOString(),
    },
  };
  if (lastAlterId != null) $set.lastAlterId = String(lastAlterId);
  if (lastMasterId != null) $set.lastMasterId = String(lastMasterId);

  return TallyModuleMapping.findOneAndUpdate(
    { organizationId, companyGuid, tallyModuleKey },
    { $set },
    { new: true }
  );
}

function buildIncrementalPullFilter({ mapping }) {
  const lastAlterId = mapping?.lastAlterId || mapping?.watermark?.lastAlterId || null;
  return {
    sinceAlterId: lastAlterId,
    dateWindowDays: mapping?.filter?.dateWindowDays || null,
    syncFrom: mapping?.syncFrom || mapping?.filter?.syncFrom || null,
    postedOnly: mapping?.filter?.postedOnly !== false,
    parents: mapping?.filter?.parents || [],
    excludeSystemLedgers: mapping?.filter?.excludeSystemLedgers !== false,
  };
}

module.exports = {
  extractAlterId,
  extractGuid,
  extractName,
  detectChanges,
  advanceWatermark,
  buildIncrementalPullFilter,
};
