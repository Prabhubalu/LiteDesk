const mongoose = require('mongoose');
const Case = require('../../models/Case');
const { parseCaseListQuery } = require('../caseListQuery');
const {
  CASE_PRIORITIES,
  CASE_TYPES,
  CASE_CHANNELS,
} = require('../../constants/caseLifecycle');

function buildCasesListQuery(req) {
  const parsedQuery = parseCaseListQuery(req.query || {}, {
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
  return query;
}

module.exports = {
  buildCasesListQuery,
};
