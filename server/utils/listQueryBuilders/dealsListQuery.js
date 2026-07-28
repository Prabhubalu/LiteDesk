const mongoose = require('mongoose');
const { applyProjectionFilter } = require('../appProjectionQuery');
const { getProjection } = require('../moduleProjectionResolver');

function buildDealsListQuery(req) {
  let query = { organizationId: req.user.organizationId, deletedAt: null };

  const { applyListSharingToQuery } = require('../sharingQueryUtils');
  applyListSharingToQuery(query, req, 'deals');

  if (req.query.stage) query.stage = req.query.stage;
  if (req.query.status) query.status = req.query.status;
  if (req.query.priority) query.priority = req.query.priority;
  if (req.query.assignedTo) {
    query.assignedTo =
      req.query.assignedTo === 'me' ? req.user._id : req.query.assignedTo;
  }
  if (req.query.contactId) query.contactId = req.query.contactId;
  if (req.query.accountId) {
    if (mongoose.Types.ObjectId.isValid(req.query.accountId)) {
      query.accountId = new mongoose.Types.ObjectId(req.query.accountId);
    } else {
      query.accountId = req.query.accountId;
    }
  }
  if (req.query.pipeline) query.pipeline = req.query.pipeline;

  const { buildSearchOrConditions } = require('../searchRelevance');
  const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
  if (directSearchTerm) {
    query.$or = buildSearchOrConditions(directSearchTerm, ['name', 'description']);
  }

  if (req.query.fromDate || req.query.toDate) {
    query.expectedCloseDate = {};
    if (req.query.fromDate) {
      query.expectedCloseDate.$gte = new Date(req.query.fromDate);
    }
    if (req.query.toDate) {
      query.expectedCloseDate.$lte = new Date(req.query.toDate);
    }
  }

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  query = applyListFilterQueryParam(query, req.query, 'deals', { userId: req.user?._id });

  return query;
}

module.exports = {
  buildDealsListQuery,
};
