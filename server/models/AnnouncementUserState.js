const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const AnnouncementUserStateSchema = new mongoose.Schema({
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
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  firstViewedAt: { type: Date, default: null },
  lastViewedAt: { type: Date, default: null },
  viewCount: { type: Number, default: 0 },
  dismissedAt: { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
  lastShownAt: { type: Date, default: null },
  ctaClicks: {
    type: [{
      ctaId: { type: String, required: true },
      clickedAt: { type: Date, default: Date.now },
      count: { type: Number, default: 1 },
    }],
    default: [],
  },
}, {
  timestamps: true,
});

AnnouncementUserStateSchema.index(
  { organizationId: 1, userId: 1, announcementId: 1 },
  { unique: true },
);
AnnouncementUserStateSchema.index({ announcementId: 1, userId: 1 });

module.exports = wrapTenantModel(
  mongoose.model('AnnouncementUserState', AnnouncementUserStateSchema),
);
