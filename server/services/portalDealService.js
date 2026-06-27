'use strict';

const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const { resolvePortalPersonContext } = require('./portalUserScopeService');

async function buildPortalDealAccessQuery(organizationId, user) {
  const { contactIds, businessOrganizationId } = await resolvePortalPersonContext(
    organizationId,
    user
  );
  const scopedContactIds = [...contactIds];
  if (user?.peopleId) {
    scopedContactIds.push(user.peopleId);
  }
  const uniqueContactIds = [...new Set(scopedContactIds.map((id) => String(id)))];
  const or = [];

  if (uniqueContactIds.length) {
    or.push({ contactId: { $in: uniqueContactIds } });
    or.push({ 'dealPeople.personId': { $in: uniqueContactIds } });
  }
  if (businessOrganizationId) {
    or.push({ accountId: businessOrganizationId });
    or.push({ 'dealOrganizations.organizationId': businessOrganizationId });
  }

  if (!or.length) {
    return { organizationId, deletedAt: null, _id: null };
  }

  return {
    organizationId,
    deletedAt: null,
    $or: or
  };
}

function shapePortalDealSummary(row) {
  return {
    _id: row._id,
    name: row.name,
    amount: row.amount,
    currency: row.currency || 'USD',
    stage: row.stage,
    status: row.status,
    probability: row.probability,
    expectedCloseDate: row.expectedCloseDate,
    updatedAt: row.updatedAt
  };
}

function shapePortalDealDetail(row) {
  return {
    ...shapePortalDealSummary(row),
    pipeline: row.pipeline || '',
    description: row.description || '',
    actualCloseDate: row.actualCloseDate || null,
    createdAt: row.createdAt
  };
}

async function listPortalDeals(organizationId, user, { limit = 25, skip = 0 } = {}) {
  const query = await buildPortalDealAccessQuery(organizationId, user);
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const [rows, total] = await Promise.all([
    Deal.find(query)
      .select('name amount currency stage status probability expectedCloseDate updatedAt')
      .sort({ updatedAt: -1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean(),
    Deal.countDocuments(query)
  ]);

  return {
    rows: rows.map(shapePortalDealSummary),
    total
  };
}

async function getPortalDealById(organizationId, dealId, user) {
  const id = String(dealId || '').trim();
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const query = await buildPortalDealAccessQuery(organizationId, user);
  return Deal.findOne({
    ...query,
    _id: id
  })
    .select(
      'name amount currency stage status probability expectedCloseDate actualCloseDate pipeline description createdAt updatedAt'
    )
    .lean();
}

module.exports = {
  buildPortalDealAccessQuery,
  listPortalDeals,
  getPortalDealById,
  shapePortalDealSummary,
  shapePortalDealDetail
};
