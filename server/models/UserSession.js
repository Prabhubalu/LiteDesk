'use strict';

/**
 * Active auth sessions (tenant-scoped). JWT jti maps to sessionId.
 * @see docs/architecture/EXTERNAL_USER_PORTAL_FRAMEWORK.md §11
 */

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const UserSessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    authSessionVersion: {
      type: Number,
      default: 0
    },
    userType: {
      type: String,
      enum: ['INTERNAL', 'EXTERNAL', 'SYSTEM'],
      default: 'INTERNAL'
    },
    ipAddress: { type: String, trim: true, default: null },
    userAgent: { type: String, trim: true, default: null },
    issuedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null, index: true }
  },
  { timestamps: false }
);

UserSessionSchema.index({ organizationId: 1, userId: 1, revokedAt: 1, issuedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('UserSession', UserSessionSchema));
