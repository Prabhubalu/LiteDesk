'use strict';

const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const {
  ensureOrgEmailPolicy,
  getOrgEmailPolicy,
  serializeOrgEmailPolicy,
  refreshOrgEmailReputation,
  refreshOrgEmailReputationGuidance,
  refreshOrgEmailThroughput
} = require('../services/orgEmailPolicyService');
const { deriveBurstRatePerMin } = require('../constants/emailPolicyDefaults');
const { syncOrgPolicyToAmds } = require('../services/amds/amds-policy-sync');
const {
  onCreditPackPurchased,
  onOrgEmailSendingReactivated,
  onOrgEmailSendingSuspended
} = require('../services/billing/email-credits');
const { AmdsApiError } = require('../services/amds/amds-errors');

function requireOrgAdmin(req, res) {
  if (req.user?.isOwner) return true;
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin' || req.user?.isPlatformAdmin) return true;
  res.status(403).json({ success: false, message: 'Admin access required' });
  return false;
}

function handleAmdsError(err, res, next) {
  if (err instanceof AmdsApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.userMessage || err.message
    });
  }
  return next(err);
}

/**
 * GET /api/settings/email-policy
 */
exports.getEmailPolicy = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const organizationId = req.user.organizationId;
    await ensureOrgEmailPolicy(organizationId);
    await refreshOrgEmailReputation(organizationId);
    await refreshOrgEmailReputationGuidance(organizationId);
    await refreshOrgEmailThroughput(organizationId);
    const policy = await getOrgEmailPolicy(organizationId);

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/settings/email-policy/limits
 */
exports.updateEmailPolicyLimits = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const organizationId = req.user.organizationId;
    await ensureOrgEmailPolicy(organizationId);

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const OrgEmailPolicy = require('../models/org-email-policy');
    const allowedFields = [
      'dailySendLimit',
      'maxHourlyRate',
      'maxCampaignSize',
      'warmupEnabled',
      'reputationEnabled'
    ];

    /** @type {Record<string, unknown>} */
    const updates = {};
    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid limit fields provided' });
    }

    if (updates.maxHourlyRate !== undefined) {
      updates.burstRatePerMin = deriveBurstRatePerMin(Number(updates.maxHourlyRate));
    }

    const beforeDoc = await getOrgEmailPolicy(organizationId);
    const before = cloneForAudit(serializeOrgEmailPolicy(beforeDoc));

    const policy = await OrgEmailPolicy.findOneAndUpdate(
      { organizationId },
      { $set: updates },
      { new: true }
    ).lean();

    if (isAmdsEnvConfigured()) {
      await syncOrgPolicyToAmds(organizationId);
    }

    const after = cloneForAudit(serializeOrgEmailPolicy(policy));
    attachSettingsAuditDiff(res, before, after, { body: updates });

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/settings/email-policy/sync
 */
exports.forceEmailPolicySync = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const organizationId = req.user.organizationId;
    await ensureOrgEmailPolicy(organizationId);
    await syncOrgPolicyToAmds(organizationId);
    await refreshOrgEmailReputation(organizationId);
    await refreshOrgEmailReputationGuidance(organizationId);
    await refreshOrgEmailThroughput(organizationId);
    const policy = await getOrgEmailPolicy(organizationId);

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * POST /api/settings/email-policy/credits
 */
exports.allocateEmailCredits = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const organizationId = req.user.organizationId;
    const before = cloneForAudit(serializeOrgEmailPolicy(await getOrgEmailPolicy(organizationId)));
    await onCreditPackPurchased(organizationId, amount);
    const policy = await getOrgEmailPolicy(organizationId);
    const after = cloneForAudit(serializeOrgEmailPolicy(policy));
    attachSettingsAuditDiff(res, before, after, {
      keys: ['creditsRemaining', 'monthlyCredits']
    });

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * POST /api/settings/email-policy/suspend
 */
exports.suspendEmailPolicy = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const organizationId = req.user.organizationId;
    const before = cloneForAudit(serializeOrgEmailPolicy(await getOrgEmailPolicy(organizationId)));
    await onOrgEmailSendingSuspended(organizationId);
    const policy = await getOrgEmailPolicy(organizationId);
    const after = cloneForAudit(serializeOrgEmailPolicy(policy));
    attachSettingsAuditDiff(res, before, after, { keys: ['status'] });

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * POST /api/settings/email-policy/reactivate
 */
exports.reactivateEmailPolicy = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const organizationId = req.user.organizationId;
    const before = cloneForAudit(serializeOrgEmailPolicy(await getOrgEmailPolicy(organizationId)));
    await onOrgEmailSendingReactivated(organizationId);
    const policy = await getOrgEmailPolicy(organizationId);
    const after = cloneForAudit(serializeOrgEmailPolicy(policy));
    attachSettingsAuditDiff(res, before, after, { keys: ['status'] });

    return res.json({
      success: true,
      data: serializeOrgEmailPolicy(policy)
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/settings/email-policy/reputation/history
 */
exports.getEmailReputationHistory = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const client = getAmdsClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
    const history = await client.getReputationHistory(String(req.user.organizationId), limit);

    return res.json({ success: true, data: history });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/settings/email-policy/reputation/guidance
 */
exports.getEmailReputationGuidance = async (req, res, next) => {
  try {
    if (!requireOrgAdmin(req, res)) return;

    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const organizationId = req.user.organizationId;
    await ensureOrgEmailPolicy(organizationId);
    const guidance = await refreshOrgEmailReputationGuidance(organizationId);
    if (guidance) {
      return res.json({ success: true, data: guidance });
    }

    const policy = await getOrgEmailPolicy(organizationId);
    return res.json({
      success: true,
      data: {
        tenant_id: String(organizationId),
        score: policy?.senderReputation ?? null,
        previous_score: policy?.reputationPreviousScore ?? null,
        delta: policy?.reputationDelta ?? null,
        reasons: Array.isArray(policy?.reputationGuidanceReasons) ? policy.reputationGuidanceReasons : [],
        recommendations: Array.isArray(policy?.reputationGuidanceRecommendations)
          ? policy.reputationGuidanceRecommendations
          : [],
        updated_at: policy?.reputationGuidanceUpdatedAt?.toISOString?.() || null
      }
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};
