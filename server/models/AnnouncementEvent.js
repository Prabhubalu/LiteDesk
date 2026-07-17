const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const EVENT_TYPES = ['view', 'read', 'dismiss', 'acknowledge', 'cta_click'];
const SURFACES = ['web_app', 'portal', 'mobile'];

const AnnouncementEventSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: EVENT_TYPES,
  },
  ctaId: {
    type: String,
    default: null,
  },
  deviceType: {
    type: String,
    default: null,
    trim: true,
    maxlength: 40,
  },
  platform: {
    type: String,
    default: null,
    trim: true,
    maxlength: 40,
  },
  surface: {
    type: String,
    enum: SURFACES,
    default: 'web_app',
  },
  at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: false,
});

AnnouncementEventSchema.index({ organizationId: 1, announcementId: 1, type: 1, at: -1 });
AnnouncementEventSchema.index({ organizationId: 1, at: -1 });
// Auto-expire raw events after ~180 days
AnnouncementEventSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = wrapTenantModel(mongoose.model('AnnouncementEvent', AnnouncementEventSchema));
module.exports.EVENT_TYPES = EVENT_TYPES;
