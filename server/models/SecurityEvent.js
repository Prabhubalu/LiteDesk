'use strict';

/**
 * Platform security audit events (tenant-scoped, append-only).
 * Portal lifecycle, auth, and admin security actions.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PORTAL_SECURITY_EVENT_TYPES } = require('../constants/portalSecurityEventTypes');

const { Schema } = mongoose;

const CORE_SECURITY_EVENT_TYPES = [
  'password_changed',
  'password_reset_requested',
  'password_reset_completed',
  'user_suspended',
  'user_activated',
  'role_changed',
  'permission_changed',
  'two_factor_enabled',
  'two_factor_disabled',
  'security_setting_changed',
  'login_success',
  'login_failed',
  'logout'
];

const SECURITY_EVENT_TYPES = [...CORE_SECURITY_EVENT_TYPES, ...PORTAL_SECURITY_EVENT_TYPES];

const SecurityEventSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: SECURITY_EVENT_TYPES,
      required: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    peopleId: {
      type: Schema.Types.ObjectId,
      ref: 'People',
      default: null,
      index: true
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    userName: { type: String, trim: true, default: null },
    userEmail: { type: String, trim: true, default: null },
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    }
  },
  { timestamps: false }
);

SecurityEventSchema.index({ organizationId: 1, peopleId: 1, timestamp: -1 });
SecurityEventSchema.index({ organizationId: 1, type: 1, timestamp: -1 });
SecurityEventSchema.index({ organizationId: 1, userId: 1, timestamp: -1 });

module.exports = wrapTenantModel(mongoose.model('SecurityEvent', SecurityEventSchema));
