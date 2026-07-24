'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const CampaignStatsSchema = new Schema(
  {
    totalRecipients: { type: Number, default: 0 },
    queued: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    hardBounced: { type: Number, default: 0 },
    softBounced: { type: Number, default: 0 },
    complaints: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    uniqueOpens: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    totalOpens: { type: Number, default: 0 },
    totalClicks: { type: Number, default: 0 },
    deliveryRate: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    complaintRate: { type: Number, default: 0 },
    hardBounceRate: { type: Number, default: 0 },
    softBounceRate: { type: Number, default: 0 },
    sendStartedAt: { type: Date, default: null },
    sendCompletedAt: { type: Date, default: null },
    lastEngagementAt: { type: Date, default: null },
    syncedAt: { type: Date, default: null },
    sendError: { type: String, trim: true, default: null },
    prepared: { type: Number, default: 0 },
    suppressed: { type: Number, default: 0 },
    skippedUnsubscribed: { type: Number, default: 0 }
  },
  { _id: false }
);

const CampaignSendStateSchema = new Schema(
  {
    phase: {
      type: String,
      enum: ['idle', 'queued', 'resolving', 'preparing', 'running', 'submitting', 'completed', 'failed'],
      default: 'idle'
    },
    jobId: { type: String, trim: true, default: null },
    recipientSource: {
      type: String,
      enum: ['audience', 'segment', 'inline', 'snapshot'],
      default: 'inline'
    },
    audienceId: { type: Schema.Types.ObjectId, default: null },
    resolvedCount: { type: Number, default: 0 },
    preparedCount: { type: Number, default: 0 },
    lastChunkIndex: { type: Number, default: 0 },
    creditsReserved: { type: Number, default: 0 },
    error: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const CampaignSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true, maxlength: 255 },
    campaignNumber: { type: String, trim: true, index: true },
    subject: { type: String, trim: true, default: '' },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    fromEmail: { type: String, trim: true, default: '' },
    fromName: { type: String, trim: true, default: '' },
    campaignType: {
      type: String,
      enum: ['standard', 'ab_test'],
      default: 'standard'
    },
    abTest: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          winnerMetric: {
            type: String,
            enum: ['open_rate', 'click_rate'],
            default: 'open_rate'
          },
          samplePercent: { type: Number, default: 20, min: 5, max: 50 },
          testDurationHours: { type: Number, default: 4, min: 1, max: 168 },
          status: {
            type: String,
            enum: ['none', 'testing', 'winner_selected', 'completed'],
            default: 'none'
          },
          winnerVariantKey: { type: String, trim: true, default: null },
          testStartedAt: { type: Date, default: null },
          winnerSelectedAt: { type: Date, default: null }
        },
        { _id: false }
      ),
      default: () => ({
        enabled: false,
        winnerMetric: 'open_rate',
        samplePercent: 20,
        testDurationHours: 4,
        status: 'none',
        winnerVariantKey: null,
        testStartedAt: null,
        winnerSelectedAt: null
      })
    },
    variants: {
      type: [
        new Schema(
          {
            key: { type: String, trim: true, required: true },
            label: { type: String, trim: true, default: '' },
            subject: { type: String, trim: true, default: '' },
            splitPercent: { type: Number, default: 50, min: 1, max: 100 },
            stats: { type: CampaignStatsSchema, default: () => ({}) }
          },
          { _id: false }
        )
      ],
      default: () => []
    },
    heldBackRecipients: {
      type: [
        new Schema(
          {
            email: { type: String, trim: true, required: true },
            name: { type: String, trim: true, default: '' },
            recipientId: { type: String, trim: true, required: true }
          },
          { _id: false }
        )
      ],
      default: () => []
    },
    audienceId: { type: Schema.Types.ObjectId, default: null },
    templateId: { type: Schema.Types.ObjectId, default: null },
    scheduledAt: { type: Date, default: null },
    timezone: { type: String, trim: true, default: 'UTC', maxlength: 64 },
    quietHours: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          start: { type: String, trim: true, default: '22:00' },
          end: { type: String, trim: true, default: '08:00' }
        },
        { _id: false }
      ),
      default: () => ({ enabled: false, start: '22:00', end: '08:00' })
    },
    businessHours: {
      type: new Schema(
        {
          enabled: { type: Boolean, default: false },
          businessHourSetId: { type: Schema.Types.ObjectId, default: null }
        },
        { _id: false }
      ),
      default: () => ({ enabled: false, businessHourSetId: null })
    },
    scheduledRecipients: {
      type: [
        new Schema(
          {
            email: { type: String, trim: true, required: true },
            name: { type: String, trim: true, default: '' },
            recipientId: { type: String, trim: true, required: true }
          },
          { _id: false }
        )
      ],
      default: () => []
    },
    amdsCampaignId: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: [
        'draft',
        'scheduled',
        'running',
        'paused',
        'completed',
        'cancelled',
        'archived',
        'failed'
      ],
      default: 'draft'
    },
    trackOpens: { type: Boolean, default: true },
    trackClicks: { type: Boolean, default: true },
    stats: { type: CampaignStatsSchema, default: () => ({}) },
    sendState: { type: CampaignSendStateSchema, default: () => ({ phase: 'idle' }) },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvalStatus: {
      type: String,
      enum: ['none', 'pending_review', 'approved', 'rejected'],
      default: 'none',
      index: true
    },
    reviewers: {
      type: [
        new Schema(
          {
            userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            assignedAt: { type: Date, default: Date.now }
          },
          { _id: false }
        )
      ],
      default: () => []
    },
    approvalHistory: {
      type: [
        new Schema(
          {
            action: {
              type: String,
              enum: ['submitted', 'approved', 'rejected', 'content_updated'],
              required: true
            },
            userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
            comment: { type: String, trim: true, default: '' },
            at: { type: Date, default: Date.now },
            fromApprovalStatus: { type: String, trim: true, default: null },
            toApprovalStatus: { type: String, trim: true, default: null }
          },
          { _id: true }
        )
      ],
      default: () => []
    }
  },
  { timestamps: true }
);

CampaignSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
CampaignSchema.index({ organizationId: 1, campaignNumber: 1 }, { unique: true, sparse: true });

CampaignSchema.pre('validate', async function assignCampaignNumber(next) {
  if (this.campaignNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'campaigns', fieldKey: 'campaignNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('Campaign', CampaignSchema));
