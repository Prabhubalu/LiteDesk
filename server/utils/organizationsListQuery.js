const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { applyProjectionFilter } = require('./appProjectionQuery');
const { getProjection } = require('./moduleProjectionResolver');

function isMasterLikeRequest(req, currentTenantOrg) {
  const orgName = String(currentTenantOrg?.name || '').trim().toLowerCase();
  const userEmail = String(req?.user?.email || '').trim().toLowerCase();
  const isInternalEmail =
    userEmail.endsWith('@arivusystems.com')
    || userEmail.endsWith('@arivu.com')
    || userEmail.endsWith('@arivu.io');
  return orgName === 'arivu master' || orgName.includes('arivu master') || isInternalEmail;
}

/** ObjectId for $match in aggregation pipelines (Mongoose find casts strings; aggregate does not). */
function normalizeAssignedToUserId(value) {
  if (value === undefined || value === null || value === '') return value;
  const raw = String(value);
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : value;
}

function buildAssignedToUserFilter(userId, currentUserId) {
  const resolved = userId === 'me' ? currentUserId : userId;
  if (resolved === undefined || resolved === null || resolved === '') return null;
  return { assignedTo: normalizeAssignedToUserId(resolved) };
}

function mergeSearchAndAssignedToFilters(query, searchFilter, assignedToFilter) {
  if (!searchFilter && !assignedToFilter) return query;

  const next = { ...query };
  if (next.$or) {
    const conditionsToAdd = [];
    if (searchFilter) conditionsToAdd.push(searchFilter);
    if (assignedToFilter) conditionsToAdd.push(assignedToFilter);
    next.$and = [{ $or: next.$or }, ...conditionsToAdd];
    delete next.$or;
  } else if (next.$and) {
    if (searchFilter) next.$and.push(searchFilter);
    if (assignedToFilter) next.$and.push(assignedToFilter);
  } else {
    if (searchFilter && assignedToFilter) {
      next.$and = [searchFilter, assignedToFilter];
    } else if (searchFilter) {
      Object.assign(next, searchFilter);
    } else if (assignedToFilter) {
      if (assignedToFilter.$or) {
        next.$or = assignedToFilter.$or;
      } else {
        Object.assign(next, assignedToFilter);
      }
    }
  }
  return next;
}

/**
 * Mongo filter for organizations list / bulk-delete-by-query (must stay in sync).
 * @param {{ tenantOrganizationId: import('mongoose').Types.ObjectId|string, params?: Record<string, unknown>, user?: object, appKey?: string }} input
 */
async function buildOrganizationListMongoQuery({
  tenantOrganizationId,
  params = {},
  user,
  appKey = 'SALES'
}) {
  const tenantUserIds = await User.find({ organizationId: tenantOrganizationId })
    .select('_id')
    .lean();
  const userIds = tenantUserIds.map((u) => u._id);

  const currentTenantOrg = await Organization.findById(tenantOrganizationId)
    .select('name')
    .lean();
  const isMasterOrganization = isMasterLikeRequest({ user }, currentTenantOrg);

  let query = { deletedAt: null };
  if (isMasterOrganization) {
    query.isTenant = false;
  } else {
    query.createdBy = { $in: userIds };
    query.isTenant = false;
  }

  if (params.ids) {
    const parts = String(params.ids)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = parts.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (valid.length === 1) {
      query._id = valid[0];
    } else if (valid.length > 1) {
      query._id = { $in: valid };
    }
  }

  if (params.type) {
    query.types = params.type;
  }

  let searchFilter = null;
  const { buildSearchOrConditions, resolveListSearchTerm } = require('./searchRelevance');
  const searchTerm = resolveListSearchTerm(params, 'organizations');
  if (searchTerm) {
    searchFilter = { $or: buildSearchOrConditions(searchTerm, ['name']) };
  }

  let assignedToFilter = null;
  if (params.assignedTo !== undefined) {
    if (
      params.assignedTo === 'null'
      || params.assignedTo === 'unassigned'
      || params.assignedTo === null
      || params.assignedTo === ''
    ) {
      assignedToFilter = {
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } }
        ]
      };
    } else {
      assignedToFilter = buildAssignedToUserFilter(params.assignedTo, user?._id);
    }
  }

  if (params.isActive !== undefined) {
    if (params.isActive === 'true' || params.isActive === true) {
      query.isActive = true;
    } else if (params.isActive === 'false' || params.isActive === false) {
      query.isActive = false;
    }
  }

  if (params.industry) query.industry = params.industry;
  if (params.tier) query['subscription.tier'] = params.tier;
  if (params.status) query['subscription.status'] = params.status;

  const projectionMeta = getProjection(appKey, 'organizations');
  query = applyProjectionFilter({
    appKey,
    moduleKey: 'organizations',
    baseQuery: query,
    projectionMeta
  });

  let finalQuery = mergeSearchAndAssignedToFilters(query, searchFilter, assignedToFilter);

  if (params.filterQuery) {
    const { applyFilterQueryToMongoQuery } = require('./filterQueryCompiler');
    finalQuery = applyFilterQueryToMongoQuery(finalQuery, params.filterQuery, 'organizations', {
      userId: user?._id,
    });
  }

  return finalQuery;
}

module.exports = {
  isMasterLikeRequest,
  buildOrganizationListMongoQuery,
  mergeSearchAndAssignedToFilters,
  normalizeAssignedToUserId,
  buildAssignedToUserFilter,
};
