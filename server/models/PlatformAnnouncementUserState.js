'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PlatformAnnouncementUserStateSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  announcementId: {
    type: Schema.Types.ObjectId,
    ref: 'PlatformAnnouncement',
    required: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
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

PlatformAnnouncementUserStateSchema.index(
  { organizationId: 1, userId: 1, announcementId: 1 },
  { unique: true },
);

module.exports = mongoose.model('PlatformAnnouncementUserState', PlatformAnnouncementUserStateSchema);
