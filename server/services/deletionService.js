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
const TrashSnapshot = require('../models/TrashSnapshot');
const User = require('../models/User');
const { validateMoveToTrash } = require('./dependencyPolicy');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.TRASH_RETENTION_DAYS || '30', 10);

const MODEL_BY_KEY = {
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  deals: () => require('../models/Deal'),
  quotes: () => require('../models/Quote'),
  tasks: () => require('../models/Task'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  cases: () => require('../models/Case')
};

const APP_KEY_BY_MODULE = {
  people: 'SALES',
  organizations: 'SALES',
  deals: 'SALES',
  quotes: 'SALES',
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
    // CRM orgs: filter by createdBy in tenant
    query.isTenant = false;
    if (organizationId && options.tenantUserIds) {
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
    cascadeConfirmed = false
  } = params;

  const Model = MODEL_BY_KEY[moduleKey]?.();
  if (!Model) {
    return { ok: false, message: `Unknown module: ${moduleKey}` };
  }

  try {
    let findQuery;
    if (moduleKey === 'organizations') {
      const tenantUserIds = await getTenantUserIds(organizationId);
      findQuery = buildFindQuery(moduleKey, recordId, organizationId, { tenantUserIds });
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

module.exports = {
  moveToTrash,
  restore,
  purge,
  purgeExpiredRetention,
  DEFAULT_RETENTION_DAYS
};
