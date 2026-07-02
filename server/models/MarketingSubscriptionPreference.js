'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const CategoryPreferenceSchema = new Schema(
  {
    subscribed: { type: Boolean, default: true },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

const SubscriptionHistorySchema = new Schema(
  {
    action: {
      type: String,
      enum: ['subscribe', 'unsubscribe', 'update_preferences'],
      required: true
    },
    category: { type: String, trim: true, default: 'marketing' },
    source: {
      type: String,
      enum: ['preference_center', 'unsubscribe_link', 'campaign_send', 'admin', 'import'],
      default: 'preference_center'
    },
    campaignId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    recordedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const MarketingSubscriptionPreferenceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    personId: { type: Schema.Types.ObjectId, ref: 'People', default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    globalStatus: {
      type: String,
      enum: ['subscribed', 'unsubscribed'],
      default: 'subscribed'
    },
    categories: {
      marketing: { type: CategoryPreferenceSchema, default: () => ({ subscribed: true, updatedAt: null }) },
      newsletter: { type: CategoryPreferenceSchema, default: () => ({ subscribed: true, updatedAt: null }) },
      productUpdates: { type: CategoryPreferenceSchema, default: () => ({ subscribed: true, updatedAt: null }) }
    },
    history: { type: [SubscriptionHistorySchema], default: () => [] }
  },
  { timestamps: true }
);

MarketingSubscriptionPreferenceSchema.index({ organizationId: 1, email: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('MarketingSubscriptionPreference', MarketingSubscriptionPreferenceSchema)
);
