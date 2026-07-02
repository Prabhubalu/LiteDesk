'use strict';

const OrgEmailPolicy = require('../../models/org-email-policy');
const {
  applyPlanLimitsToOrgEmailPolicy,
  ensureOrgEmailPolicy,
  resolvePlanKeyForOrganization
} = require('../orgEmailPolicyService');
const {
  syncOrgPolicyToAmds,
  allocateOrgCredits
} = require('../amds/amds-policy-sync');
const { getEmailPolicyDefaultsForPlan } = require('../../constants/emailPolicyDefaults');
const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');

const LEGACY_TIER_TO_PLAN = {
  starter: 'BASIC',
  professional: 'PRO',
  enterprise: 'ENTERPRISE',
  trial: 'TRIAL',
  paid: 'PRO'
};

/**
 * @param {string} tierOrPlan
 * @returns {string}
 */
function mapTierOrPlanKey(tierOrPlan) {
  const normalized = String(tierOrPlan || '').trim();
  const upper = normalized.toUpperCase();
  if (['BASIC', 'PRO', 'ENTERPRISE', 'TRIAL'].includes(upper)) {
    return upper;
  }
  return LEGACY_TIER_TO_PLAN[normalized.toLowerCase()] || 'BASIC';
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {{ planKey?: string }} [plan]
 */
async function onSubscriptionActivated(organizationId, plan = {}) {
  const planKey = plan.planKey
    ? mapTierOrPlanKey(plan.planKey)
    : mapTierOrPlanKey(await resolvePlanKeyForOrganization(organizationId));
  await applyPlanLimitsToOrgEmailPolicy(organizationId, planKey);
  await syncOrgPolicyToAmds(organizationId);
}

/**
 * Re-sync entitlements when OrganizationSubscription.apps changes.
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function syncEmailPolicyFromOrganizationSubscription(organizationId) {
  await onSubscriptionActivated(organizationId);
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {number} packSize
 */
async function onCreditPackPurchased(organizationId, packSize) {
  const amount = Math.max(0, Number(packSize) || 0);
  if (amount <= 0) {
    throw new Error('Credit pack size must be greater than zero');
  }
  await ensureOrgEmailPolicy(organizationId);
  await allocateOrgCredits(organizationId, amount, 'credit_pack_purchase');
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function onOrgEmailSendingSuspended(organizationId) {
  await ensureOrgEmailPolicy(organizationId);
  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    { $set: { status: 'suspended' } }
  );
  await syncOrgPolicyToAmds(organizationId);

  if (!isAmdsEnvConfigured()) return;
  const client = getAmdsClient();
  if (!client) return;
  await client.suspendTenant(String(organizationId));
}

/**
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 */
async function onOrgEmailSendingReactivated(organizationId) {
  await ensureOrgEmailPolicy(organizationId);
  await OrgEmailPolicy.findOneAndUpdate(
    { organizationId },
    { $set: { status: 'active' } }
  );
  await syncOrgPolicyToAmds(organizationId);

  if (!isAmdsEnvConfigured()) return;
  const client = getAmdsClient();
  if (!client) return;
  await client.activateTenant(String(organizationId));
}

/**
 * @param {string} planKey
 */
function getPlanEmailLimits(planKey) {
  return getEmailPolicyDefaultsForPlan(mapTierOrPlanKey(planKey));
}

module.exports = {
  onSubscriptionActivated,
  syncEmailPolicyFromOrganizationSubscription,
  onCreditPackPurchased,
  onOrgEmailSendingSuspended,
  onOrgEmailSendingReactivated,
  getPlanEmailLimits,
  mapTierOrPlanKey
};
