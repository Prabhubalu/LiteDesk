const mongoose = require('mongoose');
const ModuleDefinition = require('../models/ModuleDefinition');
const { validateFieldWrite } = require('../utils/fieldAccessControl');
const { buildUpdateWithCustomFields } = require('../utils/customFieldsExtractor');
const { resolveMatchingRecordIds } = require('./bulkDeleteMatchingResolver');
const {
  isBulkUpdateModule,
  filterAllowedBulkUpdates,
} = require('../utils/bulkUpdateFieldPolicy');

const DEFAULT_BATCH_SIZE = 500;
const MAX_FIELDS_PER_REQUEST = 10;

const MODEL_BY_KEY = {
  people: () => require('../models/People'),
  organizations: () => require('../models/Organization'),
  deals: () => require('../models/Deal'),
  quotes: () => require('../models/Quote'),
  tasks: () => require('../models/Task'),
  events: () => require('../models/Event'),
  items: () => require('../models/Item'),
  cases: () => require('../models/Case'),
};

function normalizeIds(ids) {
  return [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
}

function buildBaseRecordQuery(moduleKey, organizationId, ids) {
  const orgId = mongoose.Types.ObjectId.isValid(organizationId)
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;

  const query = {
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    organizationId: orgId,
  };

  const mk = String(moduleKey || '').toLowerCase();
  const Model = MODEL_BY_KEY[mk]?.();
  if (Model?.schema?.paths?.deletedAt) {
    query.deletedAt = null;
  }
  if (mk === 'cases') {
    query.status = { $ne: 'Closed' };
  }
  if (mk === 'organizations') {
    query.isTenant = false;
  }

  return query;
}

async function loadModuleFields(organizationId, moduleKey) {
  const mod = await ModuleDefinition.findOne({
    organizationId,
    key: String(moduleKey || '').toLowerCase(),
  }).lean();
  return Array.isArray(mod?.fields) ? mod.fields : [];
}

function validateUpdatesAgainstModule(updates, moduleFields, user, moduleKey) {
  const violations = [];
  for (const fieldKey of Object.keys(updates)) {
    const validation = validateFieldWrite(fieldKey, moduleFields, user, moduleKey);
    if (!validation.allowed) {
      violations.push({ field: fieldKey, reason: validation.reason });
    }
  }
  return violations;
}

async function applyBulkUpdateBatch({
  moduleKey,
  organizationId,
  userId,
  ids,
  updates,
  moduleFields,
}) {
  const mk = String(moduleKey || '').toLowerCase();
  const Model = MODEL_BY_KEY[mk]?.();
  if (!Model) {
    throw new Error(`Bulk update is not supported for module: ${mk}`);
  }

  const uniqueIds = normalizeIds(ids);
  if (uniqueIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      requestedCount: 0,
      matchedCount: 0,
    };
  }

  const query = buildBaseRecordQuery(mk, organizationId, uniqueIds);
  const $set = buildUpdateWithCustomFields(updates, Model);
  $set.updatedBy = userId;
  $set.updatedAt = new Date();

  const result = await Model.updateMany(query, { $set });
  const matchedCount = Number(result?.matchedCount ?? 0);
  const modifiedCount = Number(result?.modifiedCount ?? 0);
  const skippedCount = Math.max(0, uniqueIds.length - matchedCount);
  const unchangedCount = Math.max(0, matchedCount - modifiedCount);

  return {
    updatedCount: modifiedCount,
    skippedCount: skippedCount + unchangedCount,
    failedCount: 0,
    failures: [],
    requestedCount: uniqueIds.length,
    matchedCount,
  };
}

/**
 * @param {object} params
 * @returns {Promise<object>}
 */
async function bulkUpdateRecords(params) {
  const {
    moduleKey,
    organizationId,
    user,
    updates,
    ids = [],
    updateMatching = false,
    listQuery = {},
    excludedIds = [],
    appKey,
    batchSize = DEFAULT_BATCH_SIZE,
    afterId = null,
  } = params;

  const mk = String(moduleKey || '').toLowerCase().trim();
  if (!isBulkUpdateModule(mk)) {
    const error = new Error(`Bulk update is not supported for module: ${mk}`);
    error.code = 'MODULE_BULK_UPDATE_UNSUPPORTED';
    throw error;
  }

  const rawUpdates = updates && typeof updates === 'object' ? updates : {};
  const updateKeys = Object.keys(rawUpdates);
  if (updateKeys.length === 0) {
    const error = new Error('updates must include at least one field');
    error.code = 'BULK_UPDATE_EMPTY';
    throw error;
  }
  if (updateKeys.length > MAX_FIELDS_PER_REQUEST) {
    const error = new Error(`Bulk update supports at most ${MAX_FIELDS_PER_REQUEST} fields per request`);
    error.code = 'BULK_UPDATE_TOO_MANY_FIELDS';
    throw error;
  }

  const moduleFields = await loadModuleFields(organizationId, mk);
  const { allowed, denied } = filterAllowedBulkUpdates(mk, rawUpdates, moduleFields);
  if (denied.length > 0) {
    const error = new Error(`Fields not allowed for bulk update: ${denied.join(', ')}`);
    error.code = 'BULK_UPDATE_FIELD_DENIED';
    error.deniedFields = denied;
    throw error;
  }
  if (Object.keys(allowed).length === 0) {
    const error = new Error('No allowed fields in updates payload');
    error.code = 'BULK_UPDATE_EMPTY';
    throw error;
  }

  const violations = validateUpdatesAgainstModule(allowed, moduleFields, user, mk);
  if (violations.length > 0) {
    const error = new Error('Field access denied');
    error.code = 'FIELD_ACCESS_DENIED';
    error.violations = violations;
    throw error;
  }

  let targetIds = normalizeIds(ids);
  const limit = Math.min(Math.max(Number(batchSize) || DEFAULT_BATCH_SIZE, 1), 5000);

  if (updateMatching) {
    targetIds = await resolveMatchingRecordIds({
      moduleKey: mk,
      organizationId,
      listQuery,
      excludedIds,
      user,
      appKey: appKey || listQuery?.appKey,
      limit,
      afterId,
    });
  } else if (targetIds.length === 0) {
    const error = new Error('ids array is required');
    error.code = 'BULK_UPDATE_NO_IDS';
    throw error;
  }

  if (targetIds.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      failures: [],
      requestedCount: 0,
      hasMore: false,
      lastId: null,
      updatedFields: Object.keys(allowed),
    };
  }

  const batchOutcome = await applyBulkUpdateBatch({
    moduleKey: mk,
    organizationId,
    userId: user._id,
    ids: targetIds,
    updates: allowed,
    moduleFields,
  });

  const hasMore = Boolean(updateMatching && targetIds.length === limit);
  const lastId = targetIds.length > 0 ? targetIds[targetIds.length - 1] : null;

  return {
    ...batchOutcome,
    hasMore,
    lastId,
    updatedFields: Object.keys(allowed),
  };
}

module.exports = {
  bulkUpdateRecords,
  DEFAULT_BATCH_SIZE,
  MAX_FIELDS_PER_REQUEST,
};
