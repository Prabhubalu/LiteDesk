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
    if (searchFilter) Object.assign(next, searchFilter);
    if (assignedToFilter) {
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
  const searchTerm = params.search || params.name;
  if (searchTerm && String(searchTerm).trim()) {
    const trimmedSearch = String(searchTerm).trim();
    searchFilter = { name: new RegExp(trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
  }

  let assignedToFilter = null;
  if (params.assignedTo !== undefined) {
    if (params.assignedTo === 'null' || params.assignedTo === null || params.assignedTo === '') {
      assignedToFilter = {
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } }
        ]
      };
    } else {
      assignedToFilter = { assignedTo: params.assignedTo };
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

  return mergeSearchAndAssignedToFilters(query, searchFilter, assignedToFilter);
}

module.exports = {
  isMasterLikeRequest,
  buildOrganizationListMongoQuery,
  mergeSearchAndAssignedToFilters
};
