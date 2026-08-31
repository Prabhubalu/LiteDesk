const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { Schema } = mongoose;

/**
 * Native mobile device push tokens (FCM / APNs via FCM).
 * Separate from browser Web Push subscriptions.
 */
const mobileDeviceSchema = new Schema({
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
  appKey: {
    type: String,
    required: true,
    enum: ['SALES', 'AUDIT', 'PORTAL']
  },
  platform: {
    type: String,
    required: true,
    enum: ['ios', 'android', 'web']
  },
  token: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    default: null
  },
  appVersion: {
    type: String,
    default: null
  },
  failureCount: {
    type: Number,
    default: 0
  },
  lastFailureAt: {
    type: Date,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

mobileDeviceSchema.index({ userId: 1, appKey: 1 });
mobileDeviceSchema.index({ organizationId: 1, appKey: 1 });
mobileDeviceSchema.index({ token: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('MobileDevice', mobileDeviceSchema));
