const mongoose = require('mongoose');
const { applyProjectionFilter } = require('../appProjectionQuery');
const { getProjection } = require('../moduleProjectionResolver');
const { getPeopleFieldQueryPath, PEOPLE_SALES_ROLE_PATH } = require('../peopleFieldRegistry');

async function buildPeopleListQuery(req) {
  const userOrgId = req.user?.organizationId;
  if (!userOrgId) {
    const error = new Error('Organization context required');
    error.statusCode = 400;
    throw error;
  }

  const orgIdObjectId = mongoose.Types.ObjectId.isValid(userOrgId)
    ? new mongoose.Types.ObjectId(userOrgId)
    : userOrgId;

  let query = { organizationId: orgIdObjectId, deletedAt: null };

  const { applyListSharingToQuery } = require('../sharingQueryUtils');
  applyListSharingToQuery(query, req, 'people');

  const peopleContext = req.query.peopleContext;
  if (peopleContext && peopleContext !== 'ALL') {
    query[`participations.${peopleContext}`] = { $exists: true, $ne: null };
  }

  const appKey = req.query.appKey || req.appKey || 'SALES';
  const moduleKey = 'people';

  const salesRoleParam = req.query.sales_type;
  if (salesRoleParam && appKey !== 'PLATFORM') {
    query[getPeopleFieldQueryPath('sales_type')] = salesRoleParam;
  }
  if (req.query.helpdesk_role && appKey !== 'PLATFORM') {
    query[getPeopleFieldQueryPath('helpdesk_role')] = req.query.helpdesk_role;
  }
  if (req.query.email) query.email = req.query.email;

  let searchCondition = null;
  let assignedToFilter = null;
  const { buildSearchOrConditions } = require('../searchRelevance');
  const { mergeSearchAndAssignedToFilters, buildAssignedToUserFilter } = require('../organizationsListQuery');
  const directSearchTerm = req.query.search && req.query.search.trim() ? req.query.search.trim() : '';
  if (directSearchTerm) {
    searchCondition = {
      $or: buildSearchOrConditions(directSearchTerm, ['first_name', 'last_name', 'email', 'phone', 'mobile']),
    };
  }

  if (req.query.assignedTo !== undefined) {
    if (
      req.query.assignedTo === 'null'
      || req.query.assignedTo === 'unassigned'
      || req.query.assignedTo === null
      || req.query.assignedTo === ''
    ) {
      assignedToFilter = {
        $or: [
          { assignedTo: null },
          { assignedTo: { $exists: false } },
        ],
      };
    } else {
      assignedToFilter = buildAssignedToUserFilter(req.query.assignedTo);
    }
    delete query.assignedTo;
  }

  if (req.query.organization !== undefined) {
    if (req.query.organization === 'null' || req.query.organization === null || req.query.organization === '') {
      query.organization = null;
    } else if (req.query.organization === 'has') {
      query.organization = { $ne: null, $exists: true };
    } else if (mongoose.Types.ObjectId.isValid(req.query.organization)) {
      query.organization = new mongoose.Types.ObjectId(req.query.organization);
    } else {
      query.organization = String(req.query.organization).trim();
    }
  }

  if (appKey !== 'PLATFORM') {
    const projectionMeta = getProjection(appKey, moduleKey);
    query = applyProjectionFilter({
      appKey,
      moduleKey,
      baseQuery: query,
      projectionMeta,
    });
  } else if (query[PEOPLE_SALES_ROLE_PATH] && query[PEOPLE_SALES_ROLE_PATH] !== null) {
    if (!req.query.sales_type) {
      delete query[PEOPLE_SALES_ROLE_PATH];
    }
  }

  query = mergeSearchAndAssignedToFilters(query, searchCondition, assignedToFilter);

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'people', { userId: req.user?._id });

  const { resolvePeopleOrganizationFilters } = require('../peopleOrganizationListFilter');
  query = await resolvePeopleOrganizationFilters(query, {
    tenantOrganizationId: orgIdObjectId,
    user: req.user,
  });

  if (appKey === 'PLATFORM' && !req.query.sales_type) {
    if (query[PEOPLE_SALES_ROLE_PATH] && typeof query[PEOPLE_SALES_ROLE_PATH] === 'object' && query[PEOPLE_SALES_ROLE_PATH].$exists === false) {
      // keep non-existence filter
    } else if (query[PEOPLE_SALES_ROLE_PATH]) {
      delete query[PEOPLE_SALES_ROLE_PATH];
    }
  }

  return query;
}

module.exports = {
  buildPeopleListQuery,
};
