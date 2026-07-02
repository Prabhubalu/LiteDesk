'use strict';

const Organization = require('../../models/Organization');
const EmailSuppression = require('../../models/EmailSuppression');
const { runWithOrganizationTenantContext } = require('../../utils/runWithOrganizationTenant');
const { normalizeEmail } = require('./marketingEmailUtils');
const {
  resolveAllMatchingPeople,
  resolvePeopleWithEmail
} = require('./marketingAudienceQueryCompiler');
const { PREVIEW_SAMPLE_MAX } = require('./marketingAudienceConstants');
const { toObjectId } = require('./marketingAudienceLinkResolver');

const SLOW_PREVIEW_MS = 3000;

async function loadSuppressedEmailSet(organizationId, emails) {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalized.length === 0) return new Set();

  const rows = await runWithOrganizationTenantContext(organizationId, async () =>
    EmailSuppression.find({
      organizationId,
      email: { $in: normalized },
      active: { $ne: false }
    })
      .select('email')
      .lean()
  );

  return new Set(rows.map((row) => normalizeEmail(row.email)).filter(Boolean));
}

async function buildOrganizationBreakdown(organizationId, orgIds) {
  const uniqueOrgIds = [...new Set(orgIds.map(String).filter(Boolean))];
  if (uniqueOrgIds.length === 0) {
    return { organizations: 0, industries: [] };
  }

  const rows = await runWithOrganizationTenantContext(organizationId, async () =>
    Organization.find({
      organizationId: toObjectId(organizationId),
      isTenant: false,
      _id: { $in: uniqueOrgIds.map(toObjectId) }
    })
      .select('industry')
      .lean()
  );

  const industryCounts = new Map();
  for (const row of rows) {
    const industry = String(row?.industry || '').trim() || 'Unknown';
    industryCounts.set(industry, (industryCounts.get(industry) || 0) + 1);
  }

  const industries = [...industryCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    organizations: uniqueOrgIds.length,
    industries
  };
}

async function buildAudiencePreviewInsights(organizationId, filterQuery, context = {}, options = {}) {
  const startedAt = Date.now();
  const sampleLimit = Math.min(
    PREVIEW_SAMPLE_MAX,
    Math.max(1, parseInt(String(options.limit || '5'), 10) || 5)
  );

  const allMatches = await resolveAllMatchingPeople(organizationId, filterQuery, context);
  const totalMatches = allMatches.length;
  const missingEmail = allMatches.filter((person) => !normalizeEmail(person.email)).length;

  const withEmailPeople = await resolvePeopleWithEmail(organizationId, filterQuery, context);

  const emailCounts = new Map();
  for (const person of withEmailPeople) {
    const email = normalizeEmail(person.email);
    if (!email) continue;
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  }

  const duplicateEmails = [...emailCounts.values()].filter((count) => count > 1).length;
  const suppressedSet = await loadSuppressedEmailSet(organizationId, [...emailCounts.keys()]);
  const suppressed = suppressedSet.size;
  const reachableRecipients = [...emailCounts.keys()].filter((email) => !suppressedSet.has(email)).length;

  const sample = withEmailPeople.slice(0, sampleLimit).map((person) => ({
    _id: person._id,
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email
  }));

  const orgIds = allMatches.map((person) => person.organization).filter(Boolean);
  const breakdown = await buildOrganizationBreakdown(organizationId, orgIds);

  const durationMs = Date.now() - startedAt;
  if (durationMs > SLOW_PREVIEW_MS) {
    console.warn(
      `[marketingAudiencePreview] slow preview (${durationMs}ms) org=${organizationId} matches=${totalMatches}`
    );
  }

  return {
    totalMatches,
    reachableRecipients,
    missingEmail,
    suppressed,
    duplicateEmails,
    sample,
    breakdown,
    refreshedAt: new Date().toISOString()
  };
}

module.exports = {
  buildAudiencePreviewInsights
};
