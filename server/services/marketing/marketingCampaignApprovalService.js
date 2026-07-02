'use strict';

const mongoose = require('mongoose');
const Campaign = require('../../models/Campaign');
const User = require('../../models/User');
const {
  notifyCampaignSubmittedForReview,
  notifyCampaignApproved,
  notifyCampaignRejected
} = require('./marketingCampaignNotificationService');

const SUBMITTABLE_STATUSES = new Set(['none', 'rejected']);
const CONTENT_FIELDS = new Set([
  'name',
  'subject',
  'bodyHtml',
  'bodyText',
  'fromEmail',
  'fromName',
  'audienceId',
  'templateId'
]);

class CampaignApprovalError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'CampaignApprovalError';
    this.statusCode = statusCode;
  }
}

function appendApprovalHistory(campaign, entry) {
  if (!Array.isArray(campaign.approvalHistory)) {
    campaign.approvalHistory = [];
  }
  campaign.approvalHistory.push({
    action: entry.action,
    userId: entry.userId || null,
    comment: String(entry.comment || '').trim(),
    at: entry.at || new Date(),
    fromApprovalStatus: entry.fromApprovalStatus || null,
    toApprovalStatus: entry.toApprovalStatus || null
  });
}

function normalizeReviewerIds(reviewerIds = []) {
  if (!Array.isArray(reviewerIds)) return [];
  const unique = new Set();
  for (const raw of reviewerIds) {
    if (!mongoose.Types.ObjectId.isValid(raw)) continue;
    unique.add(String(raw));
  }
  return Array.from(unique);
}

async function validateReviewerIds(organizationId, reviewerIds) {
  const ids = normalizeReviewerIds(reviewerIds);
  if (!ids.length) {
    throw new CampaignApprovalError('At least one reviewer is required', 400);
  }

  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const count = await User.countDocuments({
    _id: { $in: objectIds },
    organizationId,
    status: { $in: ['active', null] }
  });

  if (count !== ids.length) {
    throw new CampaignApprovalError('One or more reviewers are invalid', 400);
  }

  return objectIds;
}

function isAssignedReviewer(campaign, userId) {
  const uid = String(userId || '');
  return (campaign.reviewers || []).some((reviewer) => String(reviewer.userId) === uid);
}

function assertCanReview(campaign, userId, { hasApprovePermission = false } = {}) {
  if (campaign.approvalStatus !== 'pending_review') {
    throw new CampaignApprovalError('Campaign is not pending review', 400);
  }
  if (!hasApprovePermission && !isAssignedReviewer(campaign, userId)) {
    throw new CampaignApprovalError('You are not assigned to review this campaign', 403);
  }
}

function assertApprovedForSend(campaign) {
  if (campaign.approvalStatus !== 'approved') {
    throw new CampaignApprovalError(
      'Campaign must be approved before sending or scheduling',
      400
    );
  }
}

function applyContentUpdateApprovalReset(campaign, updateKeys) {
  const changed = updateKeys.some((key) => CONTENT_FIELDS.has(key));
  if (!changed || campaign.approvalStatus !== 'approved') {
    return false;
  }

  const fromStatus = campaign.approvalStatus;
  campaign.approvalStatus = 'none';
  appendApprovalHistory(campaign, {
    action: 'content_updated',
    userId: null,
    comment: 'Approval reset after campaign content changed',
    fromApprovalStatus: fromStatus,
    toApprovalStatus: 'none'
  });
  return true;
}

async function submitCampaignForReview(campaign, { userId, reviewerIds, comment = '' }) {
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    throw new CampaignApprovalError('Only draft or scheduled campaigns can be submitted for review', 400);
  }
  if (!SUBMITTABLE_STATUSES.has(campaign.approvalStatus)) {
    throw new CampaignApprovalError('Campaign cannot be submitted in its current approval state', 400);
  }

  const reviewerObjectIds = await validateReviewerIds(campaign.organizationId, reviewerIds);
  const fromStatus = campaign.approvalStatus;

  campaign.reviewers = reviewerObjectIds.map((id) => ({
    userId: id,
    assignedAt: new Date()
  }));
  campaign.approvalStatus = 'pending_review';
  appendApprovalHistory(campaign, {
    action: 'submitted',
    userId,
    comment,
    fromApprovalStatus: fromStatus,
    toApprovalStatus: 'pending_review'
  });

  await campaign.save();

  await notifyCampaignSubmittedForReview(campaign.toObject(), {
    actorId: userId,
    reviewerUserIds: reviewerObjectIds,
    comment
  });

  return campaign.toObject();
}

async function approveCampaign(campaign, { userId, comment = '', hasApprovePermission = false }) {
  assertCanReview(campaign, userId, { hasApprovePermission });

  const fromStatus = campaign.approvalStatus;
  campaign.approvalStatus = 'approved';
  appendApprovalHistory(campaign, {
    action: 'approved',
    userId,
    comment,
    fromApprovalStatus: fromStatus,
    toApprovalStatus: 'approved'
  });

  await campaign.save();

  await notifyCampaignApproved(campaign.toObject(), { actorId: userId, comment });
  return campaign.toObject();
}

async function rejectCampaign(campaign, { userId, comment = '', hasApprovePermission = false }) {
  assertCanReview(campaign, userId, { hasApprovePermission });

  const fromStatus = campaign.approvalStatus;
  campaign.approvalStatus = 'rejected';
  appendApprovalHistory(campaign, {
    action: 'rejected',
    userId,
    comment,
    fromApprovalStatus: fromStatus,
    toApprovalStatus: 'rejected'
  });

  await campaign.save();

  await notifyCampaignRejected(campaign.toObject(), { actorId: userId, comment });
  return campaign.toObject();
}

async function listPendingApprovals({
  organizationId,
  userId,
  hasApprovePermission = false,
  page = 1,
  limit = 20
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const filter = {
    organizationId,
    approvalStatus: 'pending_review'
  };

  if (!hasApprovePermission) {
    filter['reviewers.userId'] = userId;
  }

  const [items, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .select('name subject status approvalStatus reviewers createdByUserId updatedAt createdAt')
      .lean(),
    Campaign.countDocuments(filter)
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1
    }
  };
}

module.exports = {
  CampaignApprovalError,
  SUBMITTABLE_STATUSES,
  appendApprovalHistory,
  assertApprovedForSend,
  applyContentUpdateApprovalReset,
  submitCampaignForReview,
  approveCampaign,
  rejectCampaign,
  listPendingApprovals,
  isAssignedReviewer
};
