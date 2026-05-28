const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { Schema } = mongoose;

/**
 * Per-user, per-app notification preferences.
 * Users can mute specific events; defaults are set per app.
 * 
 * Phase 13: Extended to support external channels (push, whatsapp, sms).
 * Each channel has enabled (user preference) and available (system capability) flags.
 */
const eventPreferenceSchema = new Schema({
  inApp: { type: Boolean, default: false },
  email: { type: Boolean, default: false },
  push: { 
    enabled: { type: Boolean, default: false },
    available: { type: Boolean, default: false }
  },
  whatsapp: { 
    enabled: { type: Boolean, default: false },
    available: { type: Boolean, default: false }
  },
  sms: { 
    enabled: { type: Boolean, default: false },
    available: { type: Boolean, default: false }
  }
}, { _id: false });

const notificationPreferenceSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appKey: {
    type: String,
    required: true,
    enum: ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK']
  },
  events: {
    type: Map,
    of: eventPreferenceSchema,
    default: {}
  }
}, { timestamps: true });

notificationPreferenceSchema.index({ userId: 1, appKey: 1 }, { unique: true });

module.exports = wrapTenantModel(mongoose.model('NotificationPreference', notificationPreferenceSchema));

