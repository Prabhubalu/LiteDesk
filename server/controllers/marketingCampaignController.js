'use strict';

const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const CampaignRecipient = require('../models/CampaignRecipient');
const Communication = require('../models/Communication');
const { getAmdsClient, isAmdsEnvConfigured } = require('../config/amds');
const { AmdsApiError } = require('../services/amds/amds-errors');
const { enqueueCampaignSend, assertCampaignSendPolicy } = require('../services/marketing/campaignSendOrchestrator');
const { loadAudience } = require('../services/marketing/marketingAudienceService');
const { CAMPAIGN_SEND_INLINE_MAX } = require('../services/marketing/campaignSendConstants');
const { resolveAudienceRecipients } = require('../services/marketing/marketingAudienceService');
const { syncCampaignStatsFromAmds, reconcileCampaignStatsFromCommunications, buildCampaignProductionCommunicationFilter } = require('../services/amds/handlers/campaignStatsHandler');
const { validateCampaignContent } = require('../services/marketing/marketingCampaignContentValidationService');
const { buildCampaignCreditPrecheckChecks, computeMaxSendableRecipients, fetchCampaignSendEstimate, computeLocalSendEstimateSeconds } = require('../services/marketing/marketingCampaignCreditPrecheckService');
const {
  assertCampaignSendScaleReady,
  getCampaignSendScaleStatus
} = require('../services/marketing/campaignSendScaleGuard');
const {
  getCampaignSendMetricsSnapshot
} = require('../services/marketing/campaignSendMetrics');
const { getCampaignSendQueueState } = require('../services/marketing/campaignSendQueueService');
const { getCampaignSendOrgLimiterSnapshot } = require('../services/marketing/campaignSendOrgLimiter');
const {
  countTotalCampaignRecipients,
  resetFailedCampaignForResend
} = require('../services/marketing/campaignRecipientSnapshotService');
const { formatCampaignSendErrorMessage } = require('../services/marketing/marketingCampaignSendErrors');

const ACTIVE_CAMPAIGN_SEND_PHASES = new Set([
  'queued',
  'resolving',
  'preparing',
  'running',
  'submitting'
]);
const CAMPAIGN_DELETABLE_STATUSES = new Set(['draft', 'completed', 'cancelled', 'failed', 'archived']);
const { sendCampaignTest } = require('../services/marketing/sendCampaignTest');
const { scheduleCampaignSend } = require('../services/marketing/marketingCampaignScheduleService');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const {
  CampaignApprovalError,
  assertApprovedForSend,
  applyContentUpdateApprovalReset,
  submitCampaignForReview,
  approveCampaign,
  rejectCampaign,
  listPendingApprovals
} = require('../services/marketing/marketingCampaignApprovalService');
const {
  validateAbTestConfig,
  finalizeAbTestWinner,
  buildAbResultsPayload
} = require('../services/marketing/marketingAbTestService');
const { resolveRuntimePermission } = require('../services/runtimePermissionResolver');
const {
  assertMarketingSendAllowed,
  ensureOrgEmailPolicy,
  getOrgEmailPolicy,
  serializeOrgEmailPolicy,
  refreshOrgEmailReputation,
  refreshOrgEmailThroughput,
  MARKETING_MIN_SENDER_REPUTATION
} = require('../services/orgEmailPolicyService');

const EDITABLE_STATUSES = new Set(['draft', 'scheduled']);
const SENDABLE_STATUSES = new Set(['draft', 'scheduled', 'failed']);

const CAMPAIGN_UPDATE_FIELDS = [
  'name',
  'subject',
  'bodyHtml',
  'bodyText',
  'fromEmail',
  'fromName',
  'trackOpens',
  'trackClicks',
  'campaignType',
  'audienceId',
  'templateId',
  'scheduledAt',
  'timezone',
  'quietHours',
  'businessHours',
  'campaignType',
  'abTest',
  'variants'
];

function handleAmdsError(err, res, next) {
  if (err instanceof AmdsApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(err.body?.details ? { details: err.body.details } : {})
    });
  }
  if (err instanceof Error) {
    return res.status(503).json({
      success: false,
      message: err.message || 'AMDS request failed'
    });
  }
  return next(err);
}

function handleApprovalError(res, err, fallbackMessage) {
  if (err instanceof CampaignApprovalError) {
    return res.status(err.statusCode || 400).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: err?.message || fallbackMessage });
}

function userCanApproveCampaigns(req) {
  return resolveRuntimePermission(req.user, 'campaigns', 'approve', {
    appKey: req.appKey,
    orgContext: req.user?._orgPermissionContext
  });
}

function parseObjectId(value, label = 'id') {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return { error: `${label} is invalid` };
  }
  return { id: new mongoose.Types.ObjectId(String(value)) };
}

async function loadCampaign(organizationId, campaignId) {
  return runWithOrganizationTenantContext(organizationId, async () =>
    Campaign.findOne({ _id: campaignId, organizationId })
  );
}

function buildCampaignUpdatePayload(body = {}) {
  /** @type {Record<string, unknown>} */
  const update = {};

  for (const field of CAMPAIGN_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;

    if (field === 'audienceId' || field === 'templateId') {
      if (body[field] === null || body[field] === '') {
        update[field] = null;
        continue;
      }
      const parsed = parseObjectId(body[field], field);
      if (parsed.error) {
        return { error: parsed.error };
      }
      update[field] = parsed.id;
      continue;
    }

    if (field === 'scheduledAt') {
      if (body[field] === null || body[field] === '') {
        update.scheduledAt = null;
        continue;
      }
      const date = new Date(body[field]);
      if (Number.isNaN(date.getTime())) {
        return { error: 'scheduledAt is invalid' };
      }
      update.scheduledAt = date;
      continue;
    }

    if (field === 'timezone') {
      update.timezone = String(body[field] || 'UTC').trim() || 'UTC';
      continue;
    }

    if (field === 'quietHours') {
      if (body[field] === null) {
        update.quietHours = { enabled: false, start: '22:00', end: '08:00' };
        continue;
      }
      if (typeof body[field] === 'object') {
        update.quietHours = {
          enabled: body[field].enabled === true,
          start: String(body[field].start || '22:00').trim() || '22:00',
          end: String(body[field].end || '08:00').trim() || '08:00'
        };
      }
      continue;
    }

    if (field === 'businessHours') {
      if (body[field] === null) {
        update.businessHours = { enabled: false, businessHourSetId: null };
        continue;
      }
      if (typeof body[field] === 'object') {
        const setId = body[field].businessHourSetId;
        update.businessHours = {
          enabled: body[field].enabled === true,
          businessHourSetId:
            setId && mongoose.Types.ObjectId.isValid(setId)
              ? new mongoose.Types.ObjectId(String(setId))
              : null
        };
      }
      continue;
    }

    if (field === 'trackOpens' || field === 'trackClicks') {
      update[field] = body[field] !== false;
      continue;
    }

    if (field === 'campaignType') {
      const type = String(body[field] || 'standard').trim();
      update.campaignType = type === 'ab_test' ? 'ab_test' : 'standard';
      continue;
    }

    if (field === 'abTest') {
      if (body[field] === null) {
        update.abTest = {
          enabled: false,
          winnerMetric: 'open_rate',
          samplePercent: 20,
          testDurationHours: 4,
          status: 'none',
          winnerVariantKey: null,
          testStartedAt: null,
          winnerSelectedAt: null
        };
        continue;
      }
      if (typeof body[field] === 'object') {
        update.abTest = {
          enabled: body[field].enabled === true,
          winnerMetric: body[field].winnerMetric === 'click_rate' ? 'click_rate' : 'open_rate',
          samplePercent: Math.min(50, Math.max(5, parseInt(String(body[field].samplePercent || 20), 10) || 20)),
          testDurationHours: Math.min(
            168,
            Math.max(1, parseInt(String(body[field].testDurationHours || 4), 10) || 4)
          ),
          status: ['none', 'testing', 'winner_selected', 'completed'].includes(body[field].status)
            ? body[field].status
            : 'none',
          winnerVariantKey: body[field].winnerVariantKey
            ? String(body[field].winnerVariantKey).trim()
            : null,
          testStartedAt: body[field].testStartedAt ? new Date(body[field].testStartedAt) : null,
          winnerSelectedAt: body[field].winnerSelectedAt ? new Date(body[field].winnerSelectedAt) : null
        };
      }
      continue;
    }

    if (field === 'variants') {
      if (!Array.isArray(body[field])) continue;
      update.variants = body[field]
        .map((variant) => ({
          key: String(variant?.key || '').trim(),
          label: variant?.label ? String(variant.label).trim() : '',
          subject: String(variant?.subject || '').trim(),
          splitPercent: Math.min(100, Math.max(1, parseInt(String(variant?.splitPercent || 50), 10) || 50))
        }))
        .filter((variant) => variant.key);
      continue;
    }

    update[field] = String(body[field]).trim();
  }

  if (body.html !== undefined && body.bodyHtml === undefined) {
    update.bodyHtml = String(body.html).trim();
  }
  if (body.text !== undefined && body.bodyText === undefined) {
    update.bodyText = String(body.text).trim();
  }
  if (body.from?.email !== undefined && body.fromEmail === undefined) {
    update.fromEmail = String(body.from.email).trim();
  }
  if (body.from?.name !== undefined && body.fromName === undefined) {
    update.fromName = String(body.from.name).trim();
  }

  return { update };
}

function normalizeInlineRecipients(body = {}) {
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return [];
  }

  return body.recipients
    .map((recipient) => ({
      email: String(recipient?.email || '').trim(),
      name: recipient?.name ? String(recipient.name).trim() : undefined,
      recipientId: String(recipient?.recipientId || recipient?.email || '').trim(),
      mergeData: recipient?.mergeData && typeof recipient.mergeData === 'object'
        ? recipient.mergeData
        : undefined
    }))
    .filter((recipient) => recipient.email && recipient.recipientId);
}

async function resolveSendRecipients(body = {}, campaign, organizationId) {
  const inlineRecipients = normalizeInlineRecipients(body);
  if (inlineRecipients.length > 0) {
    return inlineRecipients;
  }

  const audienceId = body.audienceId || campaign?.audienceId;
  if (!audienceId) {
    return [];
  }

  const parsed = parseObjectId(audienceId, 'audienceId');
  if (parsed.error) {
    return { error: parsed.error };
  }

  return resolveAudienceRecipients(organizationId, parsed.id);
}

/**
 * GET /api/marketing/campaigns/send-policy
 */
exports.getCampaignSendPolicy = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    await ensureOrgEmailPolicy(organizationId);
    await refreshOrgEmailReputation(organizationId);
    await refreshOrgEmailThroughput(organizationId);
    const policy = await getOrgEmailPolicy(organizationId);
    const sendCapacity = computeMaxSendableRecipients(policy);

    return res.json({
      success: true,
      data: {
        ...serializeOrgEmailPolicy(policy),
        marketingMinSenderReputation: MARKETING_MIN_SENDER_REPUTATION,
        maxSendableRecipients: sendCapacity.maxSendableRecipients,
        sendCapacityLimitingFactor: sendCapacity.limitingFactor,
        sendCapacityFactors: sendCapacity.factors,
        throughputDaily: sendCapacity.throughputDaily,
        scale: getCampaignSendScaleStatus()
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/campaigns/send-metrics
 */
exports.getCampaignSendMetrics = async (req, res, next) => {
  try {
    const queue = await getCampaignSendQueueState();
    const metrics = getCampaignSendMetricsSnapshot();

    return res.json({
      success: true,
      data: {
        metrics,
        queue,
        orgLimiter: getCampaignSendOrgLimiterSnapshot(),
        alerts: metrics.alerts
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/campaigns
 */
exports.listCampaigns = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;
    const status = String(req.query.status || '').trim();
    const approvalStatus = String(req.query.approvalStatus || '').trim();
    const search = String(req.query.search || '').trim();

    const filter = { organizationId };
    if (status) filter.status = status;
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await runWithOrganizationTenantContext(organizationId, async () => {
      const [items, total] = await Promise.all([
        Campaign.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        Campaign.countDocuments(filter)
      ]);
      return { items, total };
    });

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit))
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns
 */
exports.createCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Campaign name is required' });
    }

    const payloadResult = buildCampaignUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.create({
        organizationId,
        name,
        subject: String(req.body?.subject || '').trim(),
        bodyHtml: String(req.body?.bodyHtml || req.body?.html || '').trim(),
        bodyText: String(req.body?.bodyText || req.body?.text || '').trim(),
        fromEmail: String(req.body?.fromEmail || req.body?.from?.email || '').trim(),
        fromName: String(req.body?.fromName || req.body?.from?.name || '').trim(),
        trackOpens: req.body?.trackOpens !== false,
        trackClicks: req.body?.trackClicks !== false,
        campaignType: req.body?.campaignType === 'standard' ? 'standard' : 'standard',
        audienceId: payloadResult.update.audienceId ?? null,
        templateId: payloadResult.update.templateId ?? null,
        scheduledAt: payloadResult.update.scheduledAt ?? null,
        approvalStatus: 'none',
        reviewers: [],
        approvalHistory: [],
        createdByUserId: req.user._id
      })
    );

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/campaigns/approvals/pending
 */
exports.listPendingApprovals = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const result = await runWithOrganizationTenantContext(organizationId, async () =>
      listPendingApprovals({
        organizationId,
        userId: req.user._id,
        hasApprovePermission: userCanApproveCampaigns(req),
        page,
        limit
      })
    );

    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/submit-for-review
 */
exports.submitCampaignForReview = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const data = await submitCampaignForReview(campaign, {
      userId: req.user._id,
      reviewerIds: req.body?.reviewerIds || req.body?.reviewers || [],
      comment: req.body?.comment || ''
    });

    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof CampaignApprovalError) {
      return handleApprovalError(res, err, 'Failed to submit campaign for review');
    }
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/approve
 */
exports.approveCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const data = await approveCampaign(campaign, {
      userId: req.user._id,
      comment: req.body?.comment || '',
      hasApprovePermission: userCanApproveCampaigns(req)
    });

    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof CampaignApprovalError) {
      return handleApprovalError(res, err, 'Failed to approve campaign');
    }
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/reject
 */
exports.rejectCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const data = await rejectCampaign(campaign, {
      userId: req.user._id,
      comment: req.body?.comment || '',
      hasApprovePermission: userCanApproveCampaigns(req)
    });

    return res.json({ success: true, data });
  } catch (err) {
    if (err instanceof CampaignApprovalError) {
      return handleApprovalError(res, err, 'Failed to reject campaign');
    }
    return next(err);
  }
};

/**
 * GET /api/marketing/campaigns/:id
 */
exports.getCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await runWithOrganizationTenantContext(organizationId, async () =>
      reconcileCampaignStatsFromCommunications(organizationId, parsed.id)
    );

    const refreshed = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );

    return res.json({ success: true, data: refreshed || doc });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/marketing/campaigns/:id
 */
exports.updateCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!EDITABLE_STATUSES.has(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or scheduled campaigns can be edited'
      });
    }
    if (campaign.approvalStatus === 'pending_review') {
      return res.status(400).json({
        success: false,
        message: 'Campaign pending review cannot be edited'
      });
    }

    const payloadResult = buildCampaignUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Campaign name is required' });
      }
      payloadResult.update.name = name;
    }

    if (Object.keys(payloadResult.update).length === 0) {
      return res.json({ success: true, data: campaign.toObject() });
    }

    applyContentUpdateApprovalReset(campaign, Object.keys(payloadResult.update));
    Object.assign(campaign, payloadResult.update);
    await campaign.save();

    return res.json({ success: true, data: campaign.toObject() });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/marketing/campaigns/:id
 */
exports.deleteCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!CAMPAIGN_DELETABLE_STATUSES.has(campaign.status)) {
      return res.status(400).json({
        success: false,
        message:
          campaign.status === 'scheduled' || campaign.status === 'running' || campaign.status === 'paused'
            ? 'Cancel the campaign before deleting it'
            : 'This campaign cannot be deleted'
      });
    }

    const sendPhase = String(campaign.sendState?.phase || 'idle');
    if (ACTIVE_CAMPAIGN_SEND_PHASES.has(sendPhase)) {
      return res.status(400).json({
        success: false,
        message: 'Campaign send is in progress. Cancel the send before deleting.'
      });
    }

    await runWithOrganizationTenantContext(organizationId, async () => {
      await CampaignRecipient.deleteMany({
        organizationId,
        campaignId: parsed.id
      });
      await Campaign.deleteOne({ _id: parsed.id, organizationId });
    });
    return res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/duplicate
 */
exports.duplicateCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const source = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );
    if (!source) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const copyName = String(req.body?.name || `${source.name} (copy)`).trim();
    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.create({
        organizationId,
        name: copyName,
        subject: source.subject,
        bodyHtml: source.bodyHtml,
        bodyText: source.bodyText,
        fromEmail: source.fromEmail,
        fromName: source.fromName,
        trackOpens: source.trackOpens,
        trackClicks: source.trackClicks,
        campaignType: source.campaignType || 'standard',
        audienceId: source.audienceId || null,
        templateId: source.templateId || null,
        status: 'draft',
        approvalStatus: 'none',
        reviewers: [],
        approvalHistory: [],
        createdByUserId: req.user._id
      })
    );

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

async function transitionCampaignStatus(req, res, next, { allowedFrom, nextStatus, message }) {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!allowedFrom.has(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: message || `Campaign cannot transition from ${campaign.status}`
      });
    }

    campaign.status = nextStatus;
    await campaign.save();
    return res.json({ success: true, data: campaign.toObject() });
  } catch (err) {
    return next(err);
  }
}

exports.pauseCampaign = (req, res, next) =>
  transitionCampaignStatus(req, res, next, {
    allowedFrom: new Set(['running']),
    nextStatus: 'paused',
    message: 'Only running campaigns can be paused'
  });

exports.resumeCampaign = (req, res, next) =>
  transitionCampaignStatus(req, res, next, {
    allowedFrom: new Set(['paused']),
    nextStatus: 'running',
    message: 'Only paused campaigns can be resumed'
  });

exports.cancelCampaign = (req, res, next) =>
  transitionCampaignStatus(req, res, next, {
    allowedFrom: new Set(['draft', 'scheduled', 'running', 'paused']),
    nextStatus: 'cancelled',
    message: 'Campaign cannot be cancelled in its current state'
  });

exports.archiveCampaign = (req, res, next) =>
  transitionCampaignStatus(req, res, next, {
    allowedFrom: new Set(['completed', 'cancelled', 'failed']),
    nextStatus: 'archived',
    message: 'Only completed, cancelled, or failed campaigns can be archived'
  });

/**
 * @param {object} item
 */
function mapCampaignCommunicationRecipientRow(item) {
  return {
    _id: item._id,
    email: Array.isArray(item.toAddresses) ? item.toAddresses[0] : null,
    recipientId: item.metadata?.recipientId || null,
    status: item.status,
    sentAt: item.sentAt || null,
    openCount: item.metadata?.openCount || 0,
    clickCount: item.metadata?.clickCount || 0,
    deliveryError: item.metadata?.deliveryError || null,
    lastEvent: item.metadata?.lastAmdsEvent || null,
    createdAt: item.createdAt
  };
}

/**
 * @param {object} row
 * @param {object|null} communication
 */
function mapCampaignSnapshotRecipientRow(row, communication) {
  return {
    _id: row._id,
    email: row.email,
    recipientId: row.recipientId,
    status: communication?.status || row.status,
    sentAt: communication?.sentAt || null,
    openCount: communication?.metadata?.openCount || 0,
    clickCount: communication?.metadata?.clickCount || 0,
    deliveryError: communication?.metadata?.deliveryError || row.errorCode || null,
    lastEvent: communication?.metadata?.lastAmdsEvent || null,
    createdAt: communication?.createdAt || row.createdAt
  };
}

/**
 * @param {object[]} communications
 */
function buildCampaignCommunicationLookup(communications) {
  /** @type {Map<string, object>} */
  const byRecipientId = new Map();
  /** @type {Map<string, object>} */
  const byEmail = new Map();

  for (const communication of communications) {
    const recipientId = communication.metadata?.recipientId;
    if (recipientId) {
      byRecipientId.set(String(recipientId), communication);
    }
    const email = Array.isArray(communication.toAddresses)
      ? String(communication.toAddresses[0] || '').trim().toLowerCase()
      : '';
    if (email) {
      byEmail.set(email, communication);
    }
  }

  return { byRecipientId, byEmail };
}

/**
 * When delivery records were purged, rebuild recipient rows from the linked audience
 * only when the campaign sent to the full audience (safe for partial A/B samples).
 * @param {import('mongoose').Types.ObjectId|string} organizationId
 * @param {import('mongoose').Types.ObjectId|string} campaignId
 * @param {{ skip: number, limit: number }} pagination
 */
async function listCampaignRecipientsAudienceFallback(organizationId, campaignId, pagination) {
  const campaign = await Campaign.findOne({ _id: campaignId, organizationId })
    .select('audienceId stats.totalRecipients')
    .lean();
  if (!campaign?.audienceId) {
    return null;
  }

  const totalSent = Number(campaign.stats?.totalRecipients) || 0;
  if (totalSent <= 0) {
    return null;
  }

  const audience = await loadAudience(organizationId, campaign.audienceId);
  if (!audience) {
    return null;
  }

  const memberCount = Number(audience.memberCount) || 0;
  if (memberCount <= 0 || totalSent !== memberCount) {
    return null;
  }

  const resolved = await resolveAudienceRecipients(organizationId, campaign.audienceId);
  if (!Array.isArray(resolved) || resolved.length === 0 || resolved.length !== totalSent) {
    return null;
  }

  const pageRows = resolved.slice(pagination.skip, pagination.skip + pagination.limit);
  return {
    items: pageRows.map((row) => ({
      _id: row.recipientId || row.email,
      email: row.email,
      recipientId: row.recipientId || row.email,
      status: 'sent',
      sentAt: null,
      openCount: 0,
      clickCount: 0,
      deliveryError: null,
      lastEvent: null,
      createdAt: null
    })),
    total: resolved.length
  };
}

/**
 * GET /api/marketing/campaigns/:id/recipients
 */
exports.listCampaignRecipients = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).select('_id').lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const skip = (page - 1) * limit;
    const campaignObjectId = parsed.id;

    const result = await runWithOrganizationTenantContext(organizationId, async () => {
      const snapshotTotal = await CampaignRecipient.countDocuments({
        organizationId,
        campaignId: campaignObjectId
      });

      if (snapshotTotal > 0) {
        const [rows, communications] = await Promise.all([
          CampaignRecipient.find({ organizationId, campaignId: campaignObjectId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          Communication.find(buildCampaignProductionCommunicationFilter(organizationId, campaignObjectId))
            .select(
              'toAddresses status sentAt metadata.recipientId metadata.openCount metadata.clickCount metadata.deliveryError metadata.lastAmdsEvent createdAt'
            )
            .lean()
        ]);

        const lookup = buildCampaignCommunicationLookup(communications);
        const items = rows.map((row) => {
          const communication =
            lookup.byRecipientId.get(String(row.recipientId))
            || lookup.byEmail.get(String(row.email || '').trim().toLowerCase())
            || null;
          return mapCampaignSnapshotRecipientRow(row, communication);
        });

        return { items, total: snapshotTotal };
      }

      const filter = buildCampaignProductionCommunicationFilter(organizationId, campaignObjectId);
      const [communicationRows, total] = await Promise.all([
        Communication.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select(
            'toAddresses status sentAt metadata.recipientId metadata.openCount metadata.clickCount metadata.deliveryError metadata.lastAmdsEvent createdAt'
          )
          .lean(),
        Communication.countDocuments(filter)
      ]);

      return {
        items: communicationRows.map(mapCampaignCommunicationRecipientRow),
        total
      };
    });

    let items = result.items;
    let total = result.total;
    if (total === 0) {
      const fallback = await runWithOrganizationTenantContext(organizationId, async () =>
        listCampaignRecipientsAudienceFallback(organizationId, campaignObjectId, { skip, limit })
      );
      if (fallback) {
        items = fallback.items;
        total = fallback.total;
      }
    }

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/send
 */
exports.sendCampaign = async (req, res, next) => {
  try {
    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({ success: false, message: 'AMDS is not configured on this server' });
    }

    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await loadCampaign(organizationId, parsed.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    if (!SENDABLE_STATUSES.has(campaign.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft, scheduled, or failed campaigns can be sent'
      });
    }

    if (campaign.status === 'failed') {
      await resetFailedCampaignForResend(organizationId, parsed.id);
      campaign.status = 'draft';
    }

    try {
      assertApprovedForSend(campaign);
    } catch (err) {
      return handleApprovalError(res, err, 'Campaign must be approved before sending');
    }

    const reputationGuard = await assertMarketingSendAllowed(organizationId);
    if (!reputationGuard.allowed) {
      return res.status(403).json({
        success: false,
        code: reputationGuard.code,
        message: reputationGuard.error
      });
    }

    if (campaign.abTest?.enabled) {
      const abValidation = validateAbTestConfig(campaign);
      if (!abValidation.valid) {
        return res.status(400).json({ success: false, message: abValidation.error || 'Invalid A/B test' });
      }
    }

    const hasInlineRecipients = Array.isArray(req.body?.recipients) && req.body.recipients.length > 0;
    const linkedAudienceId = !hasInlineRecipients
      ? (req.body?.audienceId || campaign?.audienceId)
      : null;
    const useAudienceSnapshot = Boolean(
      linkedAudienceId && !hasInlineRecipients && !campaign.abTest?.enabled
    );
    const useAbAudienceSnapshot = Boolean(
      linkedAudienceId && !hasInlineRecipients && campaign.abTest?.enabled
    );

    /** @type {{ email: string, name?: string, recipientId: string, mergeData?: object }[]} */
    let recipientsResult = [];

    /** @type {import('mongoose').LeanDocument|object|null} */
    let linkedAudience = null;
    if (useAudienceSnapshot || useAbAudienceSnapshot) {
      linkedAudience = await loadAudience(organizationId, linkedAudienceId);
      if (!linkedAudience) {
        return res.status(400).json({ success: false, message: 'Audience not found' });
      }
    } else {
      const resolved = await resolveSendRecipients(req.body, campaign, organizationId);
      if (resolved.error) {
        return res.status(400).json({ success: false, message: resolved.error });
      }
      if (!Array.isArray(resolved) || resolved.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one recipient is required. Select people or attach an audience with members.'
        });
      }
      recipientsResult = resolved;
    }

    const useInlineSnapshot = Boolean(
      !useAudienceSnapshot
      && hasInlineRecipients
      && recipientsResult.length > CAMPAIGN_SEND_INLINE_MAX
      && !campaign.abTest?.enabled
    );
    const useSnapshot = useAudienceSnapshot || useInlineSnapshot || useAbAudienceSnapshot;
    const audienceChanged = Boolean(
      req.body?.audienceId
      && campaign.audienceId
      && String(req.body.audienceId) !== String(campaign.audienceId)
    );

    let estimatedRecipientCount = recipientsResult.length;
    if (linkedAudience) {
      estimatedRecipientCount = Math.max(
        Number(linkedAudience.memberCount) || 0,
        Number(campaign?.sendState?.resolvedCount) || 0
      );
    } else if (useSnapshot) {
      estimatedRecipientCount = Math.max(
        estimatedRecipientCount,
        Number(campaign?.sendState?.resolvedCount) || 0,
        await countTotalCampaignRecipients(organizationId, parsed.id)
      );
    }

    try {
      assertCampaignSendScaleReady(estimatedRecipientCount);
    } catch (scaleErr) {
      return res.status(503).json({
        success: false,
        message: scaleErr instanceof Error ? scaleErr.message : String(scaleErr)
      });
    }

    try {
      await assertCampaignSendPolicy(organizationId, estimatedRecipientCount);
    } catch (policyErr) {
      return res.status(400).json({
        success: false,
        message: policyErr instanceof Error ? policyErr.message : String(policyErr)
      });
    }

    const enqueueResult = await enqueueCampaignSend({
      organizationId,
      campaignId: parsed.id,
      recipients: useSnapshot ? recipientsResult : recipientsResult,
      useSnapshot,
      abTestEnabled: Boolean(campaign.abTest?.enabled),
      forceSnapshot: audienceChanged,
      recipientCount: estimatedRecipientCount,
      from: req.body?.from,
      subject: req.body?.subject,
      content: req.body?.content,
      trackOpens: req.body?.trackOpens,
      trackClicks: req.body?.trackClicks,
      recipientSource: useSnapshot
        ? 'snapshot'
        : (hasInlineRecipients ? 'inline' : (linkedAudienceId ? 'audience' : 'inline')),
      audienceId: useAudienceSnapshot || useAbAudienceSnapshot ? linkedAudienceId : undefined
    });

    return res.status(202).json({
      success: true,
      data: {
        jobId: enqueueResult.jobId,
        phase: enqueueResult.phase,
        mode: enqueueResult.mode,
        recipientCount: enqueueResult.recipientCount,
        sendState: {
          phase: enqueueResult.phase,
          jobId: enqueueResult.jobId,
          resolvedCount: enqueueResult.recipientCount
        }
      }
    });
  } catch (err) {
    if (err instanceof Error && /not found|already sent|required|not configured|cannot be sent/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/marketing/campaigns/:id/send-progress
 */
exports.getCampaignSendProgress = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId })
        .select('status sendState stats')
        .lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const sendState = campaign.sendState || {};
    const stats = campaign.stats || {};
    const phase = sendState.phase || 'idle';
    const resolvedCount = Math.max(
      0,
      sendState.resolvedCount ?? stats.totalRecipients ?? 0
    );
    const preparedCount = Math.max(
      0,
      sendState.preparedCount ?? stats.prepared ?? 0
    );
    const percentComplete =
      phase === 'completed'
        ? 100
        : resolvedCount > 0
          ? Math.min(100, Math.round((preparedCount / resolvedCount) * 100))
          : 0;

    const policy = await getOrgEmailPolicy(organizationId);
    const creditsReserved = sendState.creditsReserved ?? 0;

    let estimate = null;
    if (resolvedCount > 0 && ACTIVE_CAMPAIGN_SEND_PHASES.has(phase)) {
      const remoteEstimate = await fetchCampaignSendEstimate(
        organizationId,
        parsed.id,
        resolvedCount
      );
      const localSeconds = computeLocalSendEstimateSeconds(
        resolvedCount,
        policy?.effectiveHourlyRate,
        policy?.maxHourlyRate,
        policy?.effectiveBurstRate
      );
      estimate = {
        estimatedSeconds: remoteEstimate?.estimatedSeconds ?? localSeconds,
        estimatedCompletion: remoteEstimate?.estimatedCompletion ?? null
      };
    }

    return res.json({
      success: true,
      data: {
        status: campaign.status,
        phase,
        isActive: ACTIVE_CAMPAIGN_SEND_PHASES.has(phase),
        jobId: sendState.jobId || null,
        resolvedCount,
        preparedCount,
        prepared: stats.prepared ?? preparedCount,
        queued: stats.queued ?? 0,
        rejected: stats.rejected ?? 0,
        suppressed: stats.suppressed ?? 0,
        skippedUnsubscribed: stats.skippedUnsubscribed ?? 0,
        percentComplete,
        creditsReserved,
        credits: policy
          ? {
              creditsRemaining: policy.creditsRemaining ?? 0,
              creditsReserved: policy.creditsReserved ?? 0,
              monthlyCredits: policy.monthlyCredits ?? 0
            }
          : null,
        estimate,
        error: formatCampaignSendErrorMessage(sendState.error || stats.sendError || null)
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/campaigns/:id/precheck
 */
exports.getCampaignPrecheck = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const validation = validateCampaignContent(campaign);
    const recipientCount = Math.max(
      0,
      Number.parseInt(String(req.query.recipientCount || ''), 10) || 0
    );
    const creditPrecheck = await buildCampaignCreditPrecheckChecks(organizationId, recipientCount);
    const estimate =
      recipientCount > 0
        ? await fetchCampaignSendEstimate(organizationId, parsed.id, recipientCount)
        : null;

    const checks = [...validation.checks, ...creditPrecheck.checks];
    const blocking = checks.filter((check) => check.status === 'error');

    return res.json({
      success: true,
      data: {
        ...validation,
        checks,
        ready: blocking.length === 0,
        credits: creditPrecheck.credits,
        throughput: estimate?.throughput || creditPrecheck.throughput,
        estimate: estimate
          ? {
              estimatedSeconds: estimate.estimatedSeconds,
              estimatedCompletion: estimate.estimatedCompletion
            }
          : null
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/schedule
 */
exports.scheduleCampaign = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const scheduledAt = req.body?.scheduledAt;
    if (!scheduledAt) {
      return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    }

    const reputationGuard = await assertMarketingSendAllowed(organizationId);
    if (!reputationGuard.allowed) {
      return res.status(403).json({
        success: false,
        code: reputationGuard.code,
        message: reputationGuard.error
      });
    }

    const inlineRecipients = normalizeInlineRecipients(req.body);
    const audienceId = req.body?.audienceId || undefined;

    const campaign = await scheduleCampaignSend({
      organizationId,
      campaignId: parsed.id,
      scheduledAt,
      timezone: req.body?.timezone,
      quietHours: req.body?.quietHours,
      businessHours: req.body?.businessHours,
      audienceId,
      recipients: inlineRecipients.length > 0 ? inlineRecipients : undefined
    });

    return res.json({ success: true, data: campaign });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/test
 */
exports.testSendCampaign = async (req, res, next) => {
  try {
    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({ success: false, message: 'AMDS is not configured on this server' });
    }

    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const email = String(req.body?.email || '').trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Test recipient email is required' });
    }

    const result = await sendCampaignTest({
      organizationId,
      campaignId: parsed.id,
      recipient: {
        email,
        name: req.body?.name ? String(req.body.name).trim() : undefined
      }
    });

    return res.status(202).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof Error && /required|not found|invalid|not configured/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/marketing/campaigns/:id/ab-results
 */
exports.getCampaignAbResults = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    return res.json({ success: true, data: buildAbResultsPayload(campaign) });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/campaigns/:id/select-ab-winner
 */
exports.selectCampaignAbWinner = async (req, res, next) => {
  try {
    if (!isAmdsEnvConfigured()) {
      return res.status(503).json({ success: false, message: 'AMDS is not configured on this server' });
    }

    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const result = await finalizeAbTestWinner({
      organizationId,
      campaignId: parsed.id,
      variantKey: req.body?.variantKey ? String(req.body.variantKey).trim() : undefined
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof Error && /not found|not in|unknown|invalid/i.test(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/marketing/campaigns/:id/analytics
 */
exports.getCampaignAnalytics = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const client = getAmdsClient();
    /** @type {import('../services/amds/amds-types').AnalyticsSummaryResponse|null} */
    let summary = null;
    /** @type {import('../services/amds/amds-types').CampaignHealthResponse|null} */
    let health = null;
    let amdsUnavailable = false;

    if (client) {
      try {
        summary = await client.getAnalyticsSummary({
          tenant_id: String(organizationId),
          campaign_id: String(parsed.id),
          ...(req.query.from ? { from: String(req.query.from) } : {}),
          ...(req.query.to ? { to: String(req.query.to) } : {})
        });

        await runWithOrganizationTenantContext(organizationId, async () =>
          syncCampaignStatsFromAmds(String(organizationId), String(parsed.id), summary)
        );
      } catch (amdsErr) {
        amdsUnavailable = true;
        await runWithOrganizationTenantContext(organizationId, async () =>
          reconcileCampaignStatsFromCommunications(organizationId, parsed.id)
        );
      }

      try {
        health = await client.getCampaignHealth(String(parsed.id), String(organizationId));
      } catch {
        health = summary?.campaign_health
          ? {
              tenant_id: String(organizationId),
              campaign_id: String(parsed.id),
              message_count: summary.counts?.total ?? 0,
              score: summary.campaign_health.score,
              factors: summary.campaign_health.factors || []
            }
          : null;
      }
    } else {
      await runWithOrganizationTenantContext(organizationId, async () =>
        reconcileCampaignStatsFromCommunications(organizationId, parsed.id)
      );
    }

    const refreshed = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).select('stats status').lean()
    );

    return res.json({
      success: true,
      data: {
        summary,
        stats: refreshed?.stats || campaign.stats,
        status: refreshed?.status || campaign.status,
        health,
        ...(amdsUnavailable ? { amdsUnavailable: true } : {})
      }
    });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};

/**
 * GET /api/marketing/campaigns/:id/health
 */
exports.getCampaignHealth = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Campaign id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const campaign = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findOne({ _id: parsed.id, organizationId }).lean()
    );
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const client = getAmdsClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: 'AMDS is not configured on this server'
      });
    }

    const health = await client.getCampaignHealth(String(parsed.id), String(organizationId));
    return res.json({ success: true, data: health });
  } catch (err) {
    return handleAmdsError(err, res, next);
  }
};
