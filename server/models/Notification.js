const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { Schema } = mongoose;

/**
 * Persistent, app-scoped notification record.
 * Cross-device, auditable, and channel-aware.
 */
const notificationSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },

  // App scoping + observability
  appKey: {
    type: String,
    required: true,
    enum: ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK']
  },
  sourceAppKey: {
    type: String,
    enum: ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK'],
    default: null
  },

  eventType: {
    type: String,
    required: true
  },

  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },

  entity: {
    type: {
      type: String
    },
    id: {
      type: Schema.Types.ObjectId
    },
    title: { type: String },
    caseId: { type: String },
    authorName: { type: String },
    preview: { type: String },
    subject: { type: String },
    fromAddress: { type: String },
    chatSessionId: { type: String },
    status: { type: String },
    priority: { type: String }
  },

  channel: {
    type: String,
    enum: ['IN_APP', 'EMAIL', 'PUSH', 'WHATSAPP', 'SMS'],
    default: 'IN_APP'
  },

  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH'],
    default: 'NORMAL'
  },

  readAt: {
    type: Date,
    default: null
  },

  // Phase 16: User-defined rule metadata
  source: {
    type: String,
    enum: ['SYSTEM', 'USER_RULE'],
    default: 'SYSTEM'
  },
  ruleId: {
    type: Schema.Types.ObjectId,
    ref: 'NotificationRule',
    default: null
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ organizationId: 1, appKey: 1, createdAt: -1 });
notificationSchema.index({ readAt: 1 });
// Phase 15: Analytics indexes
notificationSchema.index({ organizationId: 1, createdAt: -1 }); // For time-range queries
notificationSchema.index({ organizationId: 1, channel: 1, createdAt: -1 }); // For channel health
notificationSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 }); // For event statistics

module.exports = wrapTenantModel(mongoose.model('Notification', notificationSchema));

