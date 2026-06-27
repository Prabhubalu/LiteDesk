const { applyProjectionFilter } = require('../appProjectionQuery');
const { getProjection } = require('../moduleProjectionResolver');

function buildFormsListQuery(req) {
  let query = { organizationId: req.user.organizationId };

  if (req.query.formType) query.formType = req.query.formType;
  if (req.query.status) query.status = req.query.status;
  if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
  if (req.query.visibility) query.visibility = req.query.visibility;

  const { buildSearchOrConditions } = require('../searchRelevance');
  const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
  if (directSearchTerm) {
    query.$or = buildSearchOrConditions(directSearchTerm, ['name', 'description', 'formId']);
  }

  const appKey = req.appKey || 'SALES';
  const moduleKey = 'forms';
  const projectionMeta = getProjection(appKey, moduleKey);
  query = applyProjectionFilter({
    appKey,
    moduleKey,
    baseQuery: query,
    projectionMeta,
  });

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'forms', { userId: req.user?._id });

  return query;
}

module.exports = {
  buildFormsListQuery,
};
