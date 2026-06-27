'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { CONTENT_AUDIT_ACTIONS } = require('../constants/contentPlatformConstants');

const { Schema } = mongoose;

const ContentAuditLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    action: { type: String, enum: CONTENT_AUDIT_ACTIONS, required: true, index: true },
    entityType: { type: String, trim: true, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'content_audit_logs' }
);

ContentAuditLogSchema.index({ organizationId: 1, entityType: 1, entityId: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ContentAuditLog', ContentAuditLogSchema));
