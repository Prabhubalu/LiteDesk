'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  CampaignApprovalError,
  assertApprovedForSend,
  applyContentUpdateApprovalReset,
  submitCampaignForReview,
  approveCampaign,
  rejectCampaign
} = require('../marketingCampaignApprovalService');

const User = require('../../../models/User');

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const reviewerId = new mongoose.Types.ObjectId();

function createCampaign(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    organizationId: orgId,
    name: 'Spring promo',
    status: 'draft',
    approvalStatus: 'none',
    reviewers: [],
    approvalHistory: [],
    createdByUserId: userId,
    toObject() {
      return { ...this };
    },
    save: async function save() {
      return this;
    },
    ...overrides
  };
}

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

test('assertApprovedForSend requires approved status', () => {
  assert.throws(
    () => assertApprovedForSend({ approvalStatus: 'none' }),
    CampaignApprovalError
  );
  assert.doesNotThrow(() => assertApprovedForSend({ approvalStatus: 'approved' }));
});

test('applyContentUpdateApprovalReset clears approved state on content edits', () => {
  const campaign = createCampaign({ approvalStatus: 'approved' });
  const changed = applyContentUpdateApprovalReset(campaign, ['subject']);
  assert.equal(changed, true);
  assert.equal(campaign.approvalStatus, 'none');
  assert.equal(campaign.approvalHistory.length, 1);
});

test('submitCampaignForReview moves campaign to pending_review', async (t) => {
  patchMethod(User, 'countDocuments', async () => 1, t);
  const campaign = createCampaign();

  const result = await submitCampaignForReview(campaign, {
    userId,
    reviewerIds: [String(reviewerId)],
    comment: 'Ready for review'
  });

  assert.equal(result.approvalStatus, 'pending_review');
  assert.equal(result.reviewers.length, 1);
});

test('approveCampaign requires pending review', async () => {
  const campaign = createCampaign({ approvalStatus: 'none' });
  await assert.rejects(
    () => approveCampaign(campaign, { userId: reviewerId, hasApprovePermission: true }),
    CampaignApprovalError
  );
});

test('rejectCampaign sets rejected status', async () => {
  const campaign = createCampaign({
    approvalStatus: 'pending_review',
    reviewers: [{ userId: reviewerId, assignedAt: new Date() }]
  });

  const result = await rejectCampaign(campaign, {
    userId: reviewerId,
    comment: 'Fix subject line',
    hasApprovePermission: false
  });

  assert.equal(result.approvalStatus, 'rejected');
});
