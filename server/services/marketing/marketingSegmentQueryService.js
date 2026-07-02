'use strict';

const mongoose = require('mongoose');
const People = require('../../models/People');
const MarketingSegment = require('../../models/MarketingSegment');
const MarketingAudience = require('../../models/MarketingAudience');
const { parseFilterQueryParam } = require('../../utils/filterQueryCompiler');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { normalizeEmail } = require('./marketingEmailUtils');
const {
  buildLegacyPeopleQuery,
  countMatchingPeople,
  queryMatchingPeople,
  resolvePeopleWithEmail
} = require('./marketingAudienceQueryCompiler');
const { getAstVersion, getPrimaryEntity } = require('./marketingAudienceAstUtils');
const { explainFilterQuery } = require('./marketingAudienceExplainService');

function toOrganizationObjectId(organizationId) {
  return mongoose.Types.ObjectId.isValid(organizationId)
    ? new mongoose.Types.ObjectId(String(organizationId))
    : organizationId;
}

function normalizeFilterAst(filterQuery) {
  return parseFilterQueryParam(filterQuery);
}

function buildSegmentPeopleQuery(organizationId, filterQuery, context = {}) {
  return buildLegacyPeopleQuery(organizationId, filterQuery, context);
}

async function countSegmentMembers(organizationId, filterQuery, context = {}) {
  return countMatchingPeople(organizationId, filterQuery, context);
}

async function querySegmentMembers(organizationId, filterQuery, options = {}) {
  const result = await queryMatchingPeople(organizationId, filterQuery, options);
  return {
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  };
}

async function loadSegment(organizationId, segmentId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    MarketingSegment.findOne({ _id: segmentId, organizationId })
  );
}

async function refreshSegmentMemberCount(segment, context = {}) {
  const count = await countSegmentMembers(segment.organizationId, segment.filterQuery, context);
  segment.memberCount = count;
  segment.lastRefreshedAt = new Date();
  segment.refreshError = null;
  await segment.save();

  await runWithOrganizationTenantContext(segment.organizationId, async () => {
    await MarketingAudience.updateMany(
      {
        organizationId: segment.organizationId,
        type: 'dynamic',
        segmentId: segment._id
      },
      { $set: { memberCount: count } }
    );
  });

  return segment;
}

async function resolveSegmentRecipients(organizationId, segmentId, context = {}) {
  const segment = await loadSegment(organizationId, segmentId);
  if (!segment) {
    return { error: 'Segment not found' };
  }

  const recipients = await resolvePeopleWithEmail(organizationId, segment.filterQuery, context);
  const normalized = recipients.map(({ email, name, recipientId, mergeData }) => ({
    email,
    name,
    recipientId,
    mergeData
  }));

  if (normalized.length === 0) {
    return { error: 'Segment matches no people with valid email addresses' };
  }

  return normalized;
}

async function refreshAllSegmentCounts() {
  const segments = await MarketingSegment.find({ filterQuery: { $ne: null } })
    .select('_id organizationId filterQuery')
    .lean();

  let refreshed = 0;
  let failed = 0;

  for (const segmentDoc of segments) {
    try {
      const segment = await MarketingSegment.findById(segmentDoc._id);
      if (!segment) continue;
      await refreshSegmentMemberCount(segment);
      refreshed += 1;
    } catch (err) {
      failed += 1;
      await MarketingSegment.updateOne(
        { _id: segmentDoc._id },
        {
          $set: {
            refreshError: String(err?.message || 'Refresh failed'),
            lastRefreshedAt: new Date()
          }
        }
      );
    }
  }

  return { refreshed, failed, total: segments.length };
}

function applySegmentMetadataFromFilterQuery(segment, filterQuery) {
  const version = getAstVersion(filterQuery);
  segment.filterQueryVersion = version;
  if (version >= 2) {
    segment.primaryEntity = getPrimaryEntity(filterQuery);
  }
  segment.explainSummary = explainFilterQuery(filterQuery).summary;
}

module.exports = {
  normalizeFilterAst,
  buildSegmentPeopleQuery,
  countSegmentMembers,
  querySegmentMembers,
  loadSegment,
  refreshSegmentMemberCount,
  resolveSegmentRecipients,
  refreshAllSegmentCounts,
  applySegmentMetadataFromFilterQuery
};
