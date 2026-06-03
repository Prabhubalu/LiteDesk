/**
 * ============================================================================
 * PLATFORM CORE: Deletion Service
 * ============================================================================
 *
 * Central entry point for all record deletions. Controllers MUST use this
 * instead of Model.deleteOne() / findByIdAndDelete.
 *
 * - moveToTrash(): Soft delete + snapshot
 * - restore(): Restore from trash
 * - purge(): Permanent delete (only from trash)
 *
 * See docs/TRASH_IMPLEMENTATION_SPEC.md
 * ============================================================================
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const TrashSnapshot = require('../models/TrashSnapshot');
const User = require('../models/User');
const { validateMoveToTrash } = require('./dependencyPolicy');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.TRASH_RETENTION_DAYS || '30', 10);

const MODEL_BY_KEY = {
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  deals: () => require('../models/Deal'),
  quotes: () => require('../models/Quote'),
  sales_orders: () => require('../models/SalesOrder'),
  tasks: () => require('../models/Task'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  cases: () => require('../models/Case')
};

const APP_KEY_BY_MODULE = {
  people: 'SALES',
  organizations: 'SALES',
  deals: 'SALES',
  quotes: 'platform',
  sales_orders: 'platform',
  tasks: 'platform',
  events: 'platform',
  items: 'platform',
  cases: 'HELPDESK'
};

/**
 * Build base query for fetching a record. Organization uses tenant context.
 */
function buildFindQuery(moduleKey, recordId, organizationId, options = {}) {
  const query = { _id: recordId };
  if (options.includeTrashed) {
    // No deletedAt filter
  } else {
    query.deletedAt = null;
  }

  if (moduleKey === 'organizations') {
    // CRM orgs: filter by createdBy in tenant (list uses same rule unless master scope)
    query.isTenant = false;
    if (
      organizationId &&
      options.tenantUserIds &&
      !options.relaxOrganizationsCreatedBy
    ) {
      query.createdBy = { $in: options.tenantUserIds };
    }
  } else {
    query.organizationId = organizationId;
  }
  return query;
}

/**
 * Get tenant user IDs for Organization context.
 */
async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId }).select('_id').lean();
  return users.map((u) => u._id);
}

/**
 * Compute checksum for snapshot integrity.
 */
function computeChecksum(obj) {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Compute display name from record for search/sort.
 */
function computeDisplayName(moduleKey, record, originalId) {
  if (!record) return String(originalId || '');
  if (moduleKey === 'people') return [record.first_name, record.last_name].filter(Boolean).join(' ') || record.email || originalId;
  if (moduleKey === 'deals' || moduleKey === 'organizations') return record.name || originalId;
  if (moduleKey === 'tasks' || moduleKey === 'events') return record.title || record.eventName || originalId;
  if (moduleKey === 'items') return record.item_name || originalId;
  if (moduleKey === 'cases') return record.title || record.caseId || String(originalId || '');
  if (moduleKey === 'quotes') return record.quoteNumber || record.quoteTitle || String(originalId || '');
  if (moduleKey === 'sales_orders') {
    return record.salesOrderNumber || record.orderTitle || String(originalId || '');
  }
  return String(originalId || '');
}

/**
 * Extract parent references from record for cascade restore.
 */
function extractParentReferences(moduleKey, record) {
  const refs = [];
  if (!record) return refs;

  if (moduleKey === 'deals') {
    if (record.contactId) refs.push({ moduleKey: 'people', recordId: record.contactId, fieldPath: 'contactId' });
    if (record.accountId) refs.push({ moduleKey: 'organizations', recordId: record.accountId, fieldPath: 'accountId' });
  }
  if (moduleKey === 'people' && record.organization) {
    refs.push({ moduleKey: 'organizations', recordId: record.organization, fieldPath: 'organization' });
  }
  if (moduleKey === 'tasks' && record.relatedTo?.id) {
    const typeMap = { contact: 'people', deal: 'deals', organization: 'organizations' };
    const parentModule = typeMap[record.relatedTo.type];
    if (parentModule) refs.push({ moduleKey: parentModule, recordId: record.relatedTo.id, fieldPath: 'relatedTo.id' });
  }
  if (moduleKey === 'cases') {
    if (record.contactId) {
      refs.push({ moduleKey: 'people', recordId: record.contactId, fieldPath: 'contactId' });
    }
    if (record.organizationRefId) {
      refs.push({ moduleKey: 'organizations', recordId: record.organizationRefId, fieldPath: 'organizationRefId' });
    }
  }
  return refs;
}

/**
 * Move record to trash (soft delete + snapshot).
 *
 * @param {Object} params
 * @param {string} params.moduleKey
 * @param {string|ObjectId} params.recordId
 * @param {string|ObjectId} params.organizationId
 * @param {string|ObjectId} params.userId
 * @param {string} [params.appKey]
 * @param {string} [params.reason]
 * @param {boolean} [params.cascadeConfirmed]
 * @returns {Promise<{ ok: boolean, blocked?: boolean, dependencies?: Array, message?: string, snapshotId?: string, retentionExpiresAt?: Date }>}
 */
async function moveToTrash(params) {
  const {
    moduleKey,
    recordId,
    organizationId,
    userId,
    appKey,
    reason,
    cascadeConfirmed = false,
    relaxOrganizationsCreatedBy = false,
    tenantUserIds: cachedTenantUserIds = null
  } = params;

  const Model = MODEL_BY_KEY[moduleKey]?.();
  if (!Model) {
    return { ok: false, message: `Unknown module: ${moduleKey}` };
  }

  try {
    let findQuery;
    if (moduleKey === 'organizations') {
      const tenantUserIds = cachedTenantUserIds || await getTenantUserIds(organizationId);
      findQuery = buildFindQuery(moduleKey, recordId, organizationId, {
        tenantUserIds,
        relaxOrganizationsCreatedBy
      });
    } else {
      findQuery = buildFindQuery(moduleKey, recordId, organizationId);
    }

    const record = await Model.findOne(findQuery).lean();
    if (!record) {
      return { ok: false, message: 'Record not found or access denied' };
    }
    if (record.deletedAt) {
      return { ok: false, message: 'Record is already in trash' };
    }

    const depResult = await validateMoveToTrash({ moduleKey, recordId, organizationId });
    if (depResult.blocked && !cascadeConfirmed) {
      return {
        ok: false,
        blocked: true,
        dependencies: depResult.dependencies,
        message: depResult.message
      };
    }

    const retentionExpiresAt = new Date();
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + DEFAULT_RETENTION_DAYS);

    const snapshot = { ...record };
    delete snapshot.__v;
    const checksum = computeChecksum(snapshot);
    const parentReferences = extractParentReferences(moduleKey, record);
    const displayName = computeDisplayName(moduleKey, record, recordId);

    const snapshotDoc = await TrashSnapshot.create({
      organizationId,
      appKey: appKey || APP_KEY_BY_MODULE[moduleKey],
      moduleKey,
      originalId: recordId,
      displayName,
      snapshot,
      checksum,
      parentReferences,
      deletedAt: new Date(),
      deletedBy: userId,
      deletionReason: reason || null,
      retentionExpiresAt,
      version: 1
    });

    await Model.updateOne(
      { _id: recordId },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: userId,
          deletionReason: reason || null
        }
      }
    );

    return {
      ok: true,
      snapshotId: snapshotDoc._id.toString(),
      retentionExpiresAt
    };
  } catch (error) {
    console.error('[deletionService] moveToTrash error:', error);
    return { ok: false, message: error.message };
  }
}

/**
 * Restore record from trash.
 *
 * @param {Object} params
 * @returns {Promise<{ ok: boolean, restored?: boolean, reason?: string, orphanedReferences?: Array }>}
 */
async function restore(params) {
  const { moduleKey, recordId, organizationId, userId } = params;

  const Model = MODEL_BY_KEY[moduleKey]?.();
  if (!Model) {
    return { ok: false, reason: 'Unknown module' };
  }

  try {
    let findQuery;
    if (moduleKey === 'organizations') {
      const tenantUserIds = await getTenantUserIds(organizationId);
      findQuery = { _id: recordId, deletedAt: { $ne: null }, isTenant: false, createdBy: { $in: tenantUserIds } };
    } else {
      findQuery = { _id: recordId, organizationId, deletedAt: { $ne: null } };
    }

    const record = await Model.findOne(findQuery);
    if (!record) {
      return { ok: false, reason: 'Record not found or not in trash' };
    }

    const snapshot = await TrashSnapshot.findOne({
      organizationId,
      moduleKey,
      originalId: recordId
    });

    if (!snapshot) {
      return { ok: false, reason: 'ALREADY_PURGED' };
    }

    const orphanedReferences = [];
    for (const ref of snapshot.parentReferences || []) {
      const ParentModel = MODEL_BY_KEY[ref.moduleKey]?.();
      if (ParentModel) {
        const parent = await ParentModel.findOne(
          ref.moduleKey === 'organizations'
            ? { _id: ref.recordId }
            : { _id: ref.recordId, organizationId }
        )
          .select('deletedAt name first_name last_name')
          .lean();
        if (!parent || parent.deletedAt) {
          orphanedReferences.push({
            moduleKey: ref.moduleKey,
            recordId: ref.recordId,
            label: parent?.name || parent?.first_name || parent?.last_name || ref.recordId.toString()
          });
        }
      }
    }

    record.deletedAt = null;
    record.deletedBy = null;
    record.deletionReason = null;
    await record.save();

    await TrashSnapshot.deleteOne({ _id: snapshot._id });

    return {
      ok: true,
      restored: true,
      orphanedReferences: orphanedReferences.length > 0 ? orphanedReferences : undefined
    };
  } catch (error) {
    console.error('[deletionService] restore error:', error);
    return { ok: false, reason: error.message };
  }
}

/**
 * Purge record permanently (only from trash).
 *
 * @param {Object} params
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function purge(params) {
  const { moduleKey, recordId, organizationId } = params;

  const Model = MODEL_BY_KEY[moduleKey]?.();
  if (!Model) {
    return { ok: false, reason: 'Unknown module' };
  }

  try {
    const snapshot = await TrashSnapshot.findOne({
      organizationId,
      moduleKey,
      originalId: recordId
    });

    if (!snapshot) {
      return { ok: false, reason: 'Snapshot not found (may already be purged)' };
    }
    if (snapshot.isLegalHold) {
      return { ok: false, reason: 'LEGAL_HOLD' };
    }

    let deleteQuery;
    if (moduleKey === 'organizations') {
      const tenantUserIds = await getTenantUserIds(organizationId);
      deleteQuery = { _id: recordId, isTenant: false, createdBy: { $in: tenantUserIds } };
    } else {
      deleteQuery = { _id: recordId, organizationId };
    }

    await Model.deleteOne(deleteQuery);
    await TrashSnapshot.deleteOne({ _id: snapshot._id });

    return { ok: true };
  } catch (error) {
    console.error('[deletionService] purge error:', error);
    return { ok: false, reason: error.message };
  }
}

/**
 * Purge all trash snapshots past retention, excluding legal hold.
 * Used by the retention cron job.
 *
 * @returns {Promise<{ purged: number, failed: number, skipped: number }>}
 */
async function purgeExpiredRetention() {
  const now = new Date();
  const snapshots = await TrashSnapshot.find({
    retentionExpiresAt: { $lt: now },
    $or: [{ isLegalHold: { $ne: true } }, { isLegalHold: null }]
  })
    .select('organizationId moduleKey originalId')
    .lean();

  let purged = 0;
  let failed = 0;
  let skipped = 0;

  for (const s of snapshots) {
    const result = await purge({
      moduleKey: s.moduleKey,
      recordId: s.originalId,
      organizationId: s.organizationId
    });
    if (result.ok) purged++;
    else if (result.reason === 'LEGAL_HOLD') skipped++;
    else failed++;
  }

  return { purged, failed, skipped };
}

const BULK_MOVE_CONCURRENCY = Math.max(
  10,
  Number(process.env.BULK_DELETE_CONCURRENCY || 80)
);

const PURGE_BATCH_SIZE = Math.max(
  100,
  Number(process.env.TRASH_PURGE_BATCH_SIZE || 2000)
);

const TRASH_INSERT_BATCH_SIZE = Math.max(
  100,
  Number(process.env.TRASH_INSERT_BATCH_SIZE || 500)
);

const PURGEABLE_SNAPSHOT_FILTER = {
  $or: [{ isLegalHold: { $ne: true } }, { isLegalHold: null }]
};

function castObjectIdList(ids) {
  const out = [];
  for (const id of ids || []) {
    const s = String(id).trim();
    if (!mongoose.Types.ObjectId.isValid(s)) continue;
    out.push(new mongoose.Types.ObjectId(s));
  }
  return out;
}

/**
 * Permanently delete preloaded trash snapshots (bulk deleteMany; no per-record round trips).
 *
 * @returns {Promise<{ purged: number, skipped: number, failed: number }>}
 */
async function purgeSnapshotDocs({ moduleKey, snapshots, organizationId }) {
  const purgeable = (snapshots || []).filter((s) => !s.isLegalHold);
  const skipped = (snapshots || []).length - purgeable.length;
  if (!purgeable.length) {
    return { purged: 0, skipped, failed: 0 };
  }

  const purgeableIds = purgeable.map((s) => s.originalId);
  const snapshotIds = purgeable.map((s) => s._id);
  const Model = MODEL_BY_KEY[moduleKey]?.();

  const ops = [TrashSnapshot.deleteMany({ _id: { $in: snapshotIds } })];
  if (Model) {
    let deleteQuery;
    if (moduleKey === 'organizations') {
      deleteQuery = { _id: { $in: purgeableIds }, isTenant: false };
    } else {
      deleteQuery = { _id: { $in: purgeableIds }, organizationId };
    }
    ops.unshift(Model.deleteMany(deleteQuery));
  }

  await Promise.all(ops);
  return { purged: purgeable.length, skipped, failed: 0 };
}

/**
 * Permanently delete a batch of trashed records for one module (bulk deleteMany).
 *
 * @returns {Promise<{ purged: number, skipped: number, failed: number }>}
 */
async function purgeModuleBatch({ moduleKey, recordIds, organizationId }) {
  const objectIds = castObjectIdList(recordIds);
  if (!objectIds.length) {
    return { purged: 0, skipped: 0, failed: 0 };
  }

  const snapshots = await TrashSnapshot.find({
    organizationId,
    moduleKey,
    originalId: { $in: objectIds },
    ...PURGEABLE_SNAPSHOT_FILTER
  })
    .select('_id originalId moduleKey isLegalHold')
    .lean();

  const skipped = objectIds.length - snapshots.length;
  if (!snapshots.length) {
    return { purged: 0, skipped, failed: 0 };
  }

  return purgeSnapshotDocs({ moduleKey, snapshots, organizationId });
}

/**
 * Purge explicit trash items in bulk (grouped by module, batched deleteMany).
 *
 * @param {Object} params
 * @param {string|ObjectId} params.organizationId
 * @param {Array<{ moduleKey: string, recordId: string }>} params.items
 */
async function purgeBulk(params) {
  const { organizationId, items } = params;
  const grouped = new Map();

  for (const entry of items || []) {
    const moduleKey = String(entry?.moduleKey || '').trim();
    const recordId = String(entry?.recordId || '').trim();
    if (!moduleKey || !recordId || !MODEL_BY_KEY[moduleKey]) continue;
    if (!grouped.has(moduleKey)) grouped.set(moduleKey, []);
    grouped.get(moduleKey).push(recordId);
  }

  let purged = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    [...grouped.entries()].map(async ([moduleKey, recordIds]) => {
      const uniqueIds = [...new Set(recordIds)];
      for (let offset = 0; offset < uniqueIds.length; offset += PURGE_BATCH_SIZE) {
        const chunk = uniqueIds.slice(offset, offset + PURGE_BATCH_SIZE);
        const result = await purgeModuleBatch({
          moduleKey,
          recordIds: chunk,
          organizationId
        });
        purged += result.purged;
        skipped += result.skipped;
        failed += result.failed;
      }
    })
  );

  return { ok: true, purged, skipped, failed };
}

/**
 * Purge all trash matching a snapshot query (e.g. entire org recycle bin).
 *
 * @param {Object} params
 * @param {string|ObjectId} params.organizationId
 * @param {Object} params.snapshotQuery - Mongo filter (must include organizationId)
 */
async function purgeAll(params) {
  const { organizationId, snapshotQuery } = params;
  const baseQuery = {
    ...snapshotQuery,
    organizationId,
    ...PURGEABLE_SNAPSHOT_FILTER
  };

  let purged = 0;
  let skipped = 0;
  let failed = 0;
  let batch;

  do {
    batch = await TrashSnapshot.find(baseQuery)
      .select('_id originalId moduleKey isLegalHold')
      .limit(PURGE_BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    const byModule = new Map();
    for (const snap of batch) {
      const mk = snap.moduleKey;
      if (!byModule.has(mk)) byModule.set(mk, []);
      byModule.get(mk).push(snap);
    }

    const chunkResults = await Promise.all(
      [...byModule.entries()].map(([moduleKey, snapshots]) =>
        purgeSnapshotDocs({ moduleKey, snapshots, organizationId })
      )
    );

    for (const result of chunkResults) {
      purged += result.purged;
      skipped += result.skipped;
      failed += result.failed;
    }
  } while (batch.length === PURGE_BATCH_SIZE);

  return { ok: true, purged, skipped, failed };
}

/**
 * Move many records to trash in one request (batched find + insertMany + bulkWrite).
 *
 * @param {Object} params
 * @param {string} params.moduleKey
 * @param {Array<string|ObjectId>} params.recordIds
 * @param {string|ObjectId} params.organizationId
 * @param {string|ObjectId} params.userId
 * @param {string} [params.appKey]
 * @param {string} [params.reason]
 * @param {boolean} [params.cascadeConfirmed]
 * @returns {Promise<{ ok: boolean, movedCount?: number, failedCount?: number, failures?: Array, message?: string }>}
 */
async function bulkMoveToTrash(params) {
  const {
    moduleKey,
    recordIds,
    organizationId,
    userId,
    user,
    appKey,
    reason,
    cascadeConfirmed = false,
    relaxOrganizationsCreatedBy: relaxOrganizationsCreatedByParam = false
  } = params;

  const Model = MODEL_BY_KEY[moduleKey]?.();
  if (!Model) {
    return { ok: false, message: `Unknown module: ${moduleKey}` };
  }

  const ids = [...new Set((recordIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, message: 'No record IDs provided' };
  }

  const objectIds = castObjectIdList(ids);
  const failures = [];
  const resolvedAppKey = appKey || APP_KEY_BY_MODULE[moduleKey];
  const tenantUserIds = moduleKey === 'organizations'
    ? await getTenantUserIds(organizationId)
    : null;

  let relaxOrganizationsCreatedBy = relaxOrganizationsCreatedByParam;
  if (moduleKey === 'organizations' && !relaxOrganizationsCreatedBy) {
    const Organization = require('../models/Organization');
    const { isMasterLikeRequest } = require('../utils/organizationsListQuery');
    const currentTenantOrg = await Organization.findById(organizationId).select('name').lean();
    const masterUser = user || (userId ? await User.findById(userId).select('email').lean() : null);
    relaxOrganizationsCreatedBy = isMasterLikeRequest({ user: masterUser }, currentTenantOrg);
  }

  let findQuery;
  if (moduleKey === 'organizations') {
    findQuery = {
      _id: { $in: objectIds },
      deletedAt: null,
      isTenant: false
    };
    if (!relaxOrganizationsCreatedBy && tenantUserIds?.length) {
      findQuery.createdBy = { $in: tenantUserIds };
    }
  } else if (moduleKey === 'events') {
    const orClauses = [];
    if (objectIds.length) orClauses.push({ _id: { $in: objectIds } });
    orClauses.push({ eventId: { $in: ids } });
    findQuery = {
      organizationId,
      deletedAt: null,
      $or: orClauses
    };
  } else {
    findQuery = {
      _id: { $in: objectIds },
      organizationId,
      deletedAt: null
    };
  }

  const records = await Model.find(findQuery).lean();
  const matchedRequestIds = new Set();
  for (const record of records) {
    for (const id of ids) {
      if (String(record._id) === id || (record.eventId && String(record.eventId) === id)) {
        matchedRequestIds.add(id);
      }
    }
  }
  for (const id of ids) {
    if (!matchedRequestIds.has(id)) {
      failures.push({
        id,
        message: 'Record not found or access denied'
      });
    }
  }

  let eligible = records;
  if (!cascadeConfirmed && records.length > 0) {
    eligible = [];
    for (let offset = 0; offset < records.length; offset += BULK_MOVE_CONCURRENCY) {
      const chunk = records.slice(offset, offset + BULK_MOVE_CONCURRENCY);
      const depResults = await Promise.all(
        chunk.map(async (record) => {
          const depResult = await validateMoveToTrash({
            moduleKey,
            recordId: record._id,
            organizationId
          });
          return { record, depResult };
        })
      );
      for (const { record, depResult } of depResults) {
        if (depResult.blocked) {
          failures.push({
            id: String(record._id),
            message: depResult.message || 'Cannot delete: dependencies exist',
            blocked: true,
            dependencies: depResult.dependencies
          });
        } else {
          eligible.push(record);
        }
      }
    }
  }

  const now = new Date();
  const retentionExpiresAt = new Date();
  retentionExpiresAt.setDate(retentionExpiresAt.getDate() + DEFAULT_RETENTION_DAYS);
  let movedCount = 0;

  for (let offset = 0; offset < eligible.length; offset += TRASH_INSERT_BATCH_SIZE) {
    const chunk = eligible.slice(offset, offset + TRASH_INSERT_BATCH_SIZE);
    const existingSnapshots = await TrashSnapshot.find({
      organizationId,
      moduleKey,
      originalId: { $in: chunk.map((r) => r._id) }
    })
      .select('originalId')
      .lean();
    const alreadySnapshotted = new Set(existingSnapshots.map((s) => String(s.originalId)));
    const needsSnapshot = chunk.filter((r) => !alreadySnapshotted.has(String(r._id)));

    if (needsSnapshot.length) {
      const snapshotPayload = needsSnapshot.map((record) => {
        const snapshot = { ...record };
        delete snapshot.__v;
        return {
          organizationId,
          appKey: resolvedAppKey,
          moduleKey,
          originalId: record._id,
          displayName: computeDisplayName(moduleKey, record, record._id),
          snapshot,
          checksum: computeChecksum(snapshot),
          parentReferences: extractParentReferences(moduleKey, record),
          deletedAt: now,
          deletedBy: userId,
          deletionReason: reason || null,
          retentionExpiresAt,
          version: 1
        };
      });

      try {
        await TrashSnapshot.insertMany(snapshotPayload, { ordered: false });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
      }
    }

    await Model.bulkWrite(
      chunk.map((record) => ({
        updateOne: {
          filter: { _id: record._id, deletedAt: null },
          update: {
            $set: {
              deletedAt: now,
              deletedBy: userId,
              deletionReason: reason || null
            }
          }
        }
      })),
      { ordered: false }
    );

    movedCount += chunk.length;
  }

  const requestedCount = ids.length;

  return {
    ok: true,
    movedCount,
    failedCount: failures.length,
    failures,
    requestedCount
  };
}

module.exports = {
  moveToTrash,
  bulkMoveToTrash,
  restore,
  purge,
  purgeBulk,
  purgeAll,
  purgeExpiredRetention,
  DEFAULT_RETENTION_DAYS
};
