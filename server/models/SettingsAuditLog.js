'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { SETTINGS_AUDIT_ACTIONS } = require('../constants/settingsAuditConstants');

const { Schema } = mongoose;

const SettingsAuditLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actorName: { type: String, trim: true, default: null },
    actorEmail: { type: String, trim: true, default: null },
    action: {
      type: String,
      enum: SETTINGS_AUDIT_ACTIONS,
      required: true,
      index: true
    },
    surface: {
      type: String,
      trim: true,
      required: true,
      index: true
    },
    entityType: { type: String, trim: true, default: null, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    summary: { type: String, trim: true, default: '' },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null }
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'settings_audit_logs'
  }
);

SettingsAuditLogSchema.index({ organizationId: 1, createdAt: -1 });
SettingsAuditLogSchema.index({ organizationId: 1, surface: 1, createdAt: -1 });
SettingsAuditLogSchema.index({ organizationId: 1, actorUserId: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('SettingsAuditLog', SettingsAuditLogSchema));
