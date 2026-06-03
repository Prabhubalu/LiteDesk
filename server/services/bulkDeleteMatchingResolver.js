/**
 * Resolve record IDs for bulk delete when user selects "all matching" on a list.
 * Uses the same filter params as the list GET (no client-side pagination).
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const { getPeopleFieldQueryPath } = require('../utils/peopleFieldRegistry');
const { applyProjectionFilter } = require('../utils/appProjectionQuery');
const { getProjection } = require('../utils/moduleProjectionResolver');
const { buildOrganizationListMongoQuery } = require('../utils/organizationsListQuery');

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

const LIST_QUERY_SKIP_KEYS = new Set([
  'page',
  'limit',
  'sortBy',
  'sortOrder',
  'peopleContext'
]);

async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId }).select('_id').lean();
  return users.map((u) => u._id);
}

function applyListFiltersToQuery(query, listQuery, moduleKey) {
  const next = { ...query };
  const search = listQuery?.search?.trim?.();
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (moduleKey === 'people') {
      next.$or = [
        { first_name: regex },
        { last_name: regex },
        { email: regex },
        { phone: regex },
        { mobile: regex }
      ];
    } else if (moduleKey === 'deals' || moduleKey === 'organizations') {
      next.name = regex;
    } else if (moduleKey === 'tasks' || moduleKey === 'events' || moduleKey === 'cases') {
      next.$or = [{ title: regex }, { eventName: regex }];
    } else if (moduleKey === 'items') {
      next.item_name = regex;
    }
  }

  for (const [key, value] of Object.entries(listQuery || {})) {
    if (LIST_QUERY_SKIP_KEYS.has(key) || key === 'search' || key === 'appKey') continue;
    if (value === undefined) continue;
    if (value === '') continue;
    if (moduleKey === 'people' && (key === 'sales_type' || key === 'helpdesk_role')) {
      next[getPeopleFieldQueryPath(key)] = value;
      continue;
    }
    if (value === 'null' || value === null) {
      next[key] = null;
    } else if (value === 'has' && key === 'organization') {
      next.organization = { $ne: null, $exists: true };
    } else {
      next[key] = value;
    }
  }

  return next;
}

async function buildBaseQuery(moduleKey, organizationId, listQuery, user, appKey) {
  if (moduleKey === 'organizations') {
    return buildOrganizationListMongoQuery({
      tenantOrganizationId: organizationId,
      params: listQuery || {},
      user,
      appKey: appKey || listQuery?.appKey || 'SALES'
    });
  }

  const orgId = mongoose.Types.ObjectId.isValid(organizationId)
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;

  let query = { organizationId: orgId, deletedAt: null };

  if (moduleKey === 'people') {
    const ctx = listQuery?.peopleContext;
    if (ctx && ctx !== 'ALL') {
      query[`participations.${ctx}`] = { $exists: true, $ne: null };
    }
    const appKey = listQuery?.appKey || 'SALES';
    if (appKey !== 'PLATFORM') {
      const projectionMeta = getProjection(appKey, 'people');
      query = applyProjectionFilter({
        appKey,
        moduleKey: 'people',
        baseQuery: query,
        projectionMeta
      });
    }
  }

  return applyListFiltersToQuery(query, listQuery, moduleKey);
}

/**
 * @returns {Promise<string[]>}
 */
async function resolveMatchingRecordIds({
  moduleKey,
  organizationId,
  listQuery = {},
  excludedIds = [],
  user,
  appKey,
  limit,
  afterId
}) {
  const mk = String(moduleKey || '').toLowerCase().trim();
  const Model = MODEL_BY_KEY[mk]?.();
  if (!Model) {
    throw new Error(`Bulk delete by query is not supported for module: ${mk}`);
  }

  const excluded = new Set((excludedIds || []).map(String));
  const query = await buildBaseQuery(mk, organizationId, listQuery, user, appKey);

  const batchLimit = Number(limit);
  const useBatch = Number.isFinite(batchLimit) && batchLimit > 0;

  if (useBatch && afterId && mongoose.Types.ObjectId.isValid(afterId)) {
    const afterObjectId = new mongoose.Types.ObjectId(afterId);
    if (query._id != null) {
      query.$and = [{ _id: query._id }, { _id: { $gt: afterObjectId } }];
      delete query._id;
    } else {
      query._id = { $gt: afterObjectId };
    }
  }

  const ids = [];

  if (useBatch) {
    const docs = await Model.find(query)
      .select('_id')
      .sort({ _id: 1 })
      .limit(batchLimit * 2)
      .lean();
    for (const doc of docs) {
      const id = String(doc._id);
      if (excluded.has(id)) continue;
      ids.push(id);
      if (ids.length >= batchLimit) break;
    }
    return ids;
  }

  const cursor = Model.find(query).select('_id').sort({ _id: 1 }).lean().cursor();
  for await (const doc of cursor) {
    const id = String(doc._id);
    if (!excluded.has(id)) ids.push(id);
  }

  return ids;
}

module.exports = {
  resolveMatchingRecordIds,
  MODEL_BY_KEY
};
