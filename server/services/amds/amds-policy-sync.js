'use strict';

const mongoose = require('mongoose');
const OrgEmailPolicy = require('../../models/org-email-policy');
const { deriveBurstRatePerMin } = require('../../constants/emailPolicyDefaults');
const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');

function normalizeOrganizationId(organizationId) {
  const id = String(organizationId);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : organizationId;
}

/**
 * @param {import('mongoose').Document|Record<string, unknown>} doc
 * @returns {import('./amds-types').TenantPolicyPayload}
 */
function toAmdsPolicy(doc) {
  return {
    status: doc.status === 'suspended' ? 'suspended' : 'active',
    monthly_credits: doc.monthlyCredits ?? 0,
    credits_remaining: doc.creditsRemaining ?? 0,
    daily_send_limit: doc.dailySendLimit ?? 0,
    max_hourly_rate: doc.maxHourlyRate ?? 0,
    burst_rate_per_min: deriveBurstRatePerMin(doc.maxHourlyRate ?? 0),
    max_campaign_size: doc.maxCampaignSize ?? 0,
    warmup_enabled: doc.warmupEnabled !== false,
    reputation_enabled: doc.reputationEnabled !== false
  };
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @returns {Promise<import('./amds-types').TenantPolicyResponse|null>}
 */
async function syncOrgPolicyToAmds(organizationId) {
  if (!isAmdsEnvConfigured()) {
    return null;
  }

  const orgObjectId = normalizeOrganizationId(organizationId);
  const orgId = String(orgObjectId);
  const doc = await OrgEmailPolicy.findOne({ organizationId: orgObjectId });
  if (!doc) {
    throw new Error(`OrgEmailPolicy not found: ${orgId}`);
  }

  const client = getAmdsClient();
  if (!client) {
    return null;
  }

  try {
    const response = await client.upsertTenantPolicy(orgId, toAmdsPolicy(doc));
    doc.amdsSyncedAt = new Date();
    doc.amdsSyncError = null;
    if (typeof response.credits_reserved === 'number') {
      doc.creditsReserved = response.credits_reserved;
    }
    await doc.save();
    return response;
  } catch (err) {
    doc.amdsSyncError = err instanceof Error ? err.message : 'sync failed';
    await doc.save();
    throw err;
  }
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} amount
 * @param {string} [reason]
 */
async function allocateOrgCredits(organizationId, amount, reason) {
  const orgObjectId = normalizeOrganizationId(organizationId);
  const orgId = String(orgObjectId);
  const doc = await OrgEmailPolicy.findOneAndUpdate(
    { organizationId: orgObjectId },
    {
      $inc: { creditsRemaining: amount, monthlyCredits: amount }
    },
    { new: true }
  );
  if (!doc) {
    throw new Error(`OrgEmailPolicy not found: ${orgId}`);
  }

  if (!isAmdsEnvConfigured()) {
    return doc;
  }

  const client = getAmdsClient();
  if (!client) {
    return doc;
  }

  const response = await client.allocateCredits(orgId, { amount, reason });
  doc.creditsRemaining = response.credits_remaining;
  doc.amdsSyncedAt = new Date();
  doc.amdsSyncError = null;
  if (typeof response.credits_reserved === 'number') {
    doc.creditsReserved = response.credits_reserved;
  }
  await doc.save();
  return doc;
}

/**
 * Retry AMDS sync for orgs with a recorded sync error.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ attempted: number, succeeded: number, failed: number }>}
 */
async function retryFailedPolicySyncs(options = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const docs = await OrgEmailPolicy.find({ amdsSyncError: { $ne: null } })
    .select('organizationId')
    .limit(limit)
    .lean();

  let succeeded = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      await syncOrgPolicyToAmds(doc.organizationId);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }

  return { attempted: docs.length, succeeded, failed };
}

module.exports = {
  toAmdsPolicy,
  syncOrgPolicyToAmds,
  allocateOrgCredits,
  retryFailedPolicySyncs
};
