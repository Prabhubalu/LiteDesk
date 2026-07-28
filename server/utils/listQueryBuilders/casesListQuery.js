const mongoose = require('mongoose');
const Case = require('../../models/Case');
const { parseCaseListQuery } = require('../caseListQuery');
const {
  CASE_PRIORITIES,
  CASE_TYPES,
  CASE_CHANNELS,
} = require('../../constants/caseLifecycle');

function buildCasesListQuery(req) {
  const queryParams = { ...(req.query || {}) };
  if (queryParams.assignedTo === 'me') {
    queryParams.assignedTo = req.user?._id;
  }
  const parsedQuery = parseCaseListQuery(queryParams, {
    CASE_STATUSES: Case.CASE_STATUSES || [],
    CASE_PRIORITIES,
    CASE_TYPES,
    CASE_CHANNELS,
  });
  if (parsedQuery.errors.length > 0) {
    const error = new Error(parsedQuery.errors[0]);
    error.statusCode = 400;
    throw error;
  }
  if (parsedQuery.filters.assignedTo && !mongoose.Types.ObjectId.isValid(parsedQuery.filters.assignedTo)) {
    const error = new Error('Invalid assignedTo filter');
    error.statusCode = 400;
    throw error;
  }

  const query = {
    organizationId: req.user.organizationId,
    deletedAt: null,
    ...parsedQuery.filters,
  };
  const { applyListSharingToQuery } = require('../sharingQueryUtils');
  applyListSharingToQuery(query, req, 'cases');
  const { applyListFilterQueryParam } = require('../listFilterQuery');
  return applyListFilterQueryParam(query, req.query, 'cases', { userId: req.user?._id });
}

module.exports = {
  buildCasesListQuery,
};
