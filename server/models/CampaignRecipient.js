'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const CampaignRecipientSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true
    },
    personId: { type: Schema.Types.ObjectId, ref: 'People', default: null },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, default: '' },
    recipientId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'prepared', 'queued', 'rejected', 'suppressed', 'skipped'],
      default: 'pending'
    },
    chunkIndex: { type: Number, default: 0 },
    variantKey: { type: String, trim: true, default: null },
    idempotencyKeyHash: { type: String, trim: true, default: null },
    communicationId: { type: Schema.Types.ObjectId, ref: 'Communication', default: null },
    errorCode: { type: String, trim: true, default: null }
  },
  { timestamps: true }
);

CampaignRecipientSchema.index({ organizationId: 1, campaignId: 1, status: 1 });
CampaignRecipientSchema.index({ organizationId: 1, campaignId: 1, email: 1 }, { unique: true });
CampaignRecipientSchema.index({ organizationId: 1, campaignId: 1, chunkIndex: 1 });

module.exports = wrapTenantModel(mongoose.model('CampaignRecipient', CampaignRecipientSchema));
