'use strict';

/**
 * Master-DB announcements authored by Arivu / system automation (not tenant-proxied).
 * Used for trial/subscription reminders (AA6) and broader platform comms (AA8).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  ANNOUNCEMENT_DISPLAY_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TRIGGERS,
  ANNOUNCEMENT_SOURCE_KINDS,
} = require('../constants/announcementConstants');

const CtaSchema = new Schema({
  id: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true, maxlength: 40 },
  actionType: {
    type: String,
    default: 'internal_route',
  },
  target: { type: String, required: true, trim: true, maxlength: 2000 },
  style: {
    type: String,
    enum: ['primary', 'secondary', 'link'],
    default: 'primary',
  },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const PLATFORM_ANNOUNCEMENT_CATEGORIES = [
  'system',
  'maintenance',
  'security',
  'product',
  'general',
];

const PlatformAnnouncementSchema = new Schema({
  templateKey: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  category: {
    type: String,
    enum: PLATFORM_ANNOUNCEMENT_CATEGORIES,
    default: 'general',
    index: true,
  },
  /** all = every tenant; organizations = targetOrganizationIds (+ optional legacy targetOrganizationId) */
  targetMode: {
    type: String,
    enum: ['all', 'organizations'],
    default: 'organizations',
  },
  /** Single-org system upserts (trial/subscription templates). */
  targetOrganizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  targetOrganizationIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Organization',
  }],
  title: { type: String, required: true, trim: true, maxlength: 200 },
  shortDescription: { type: String, default: '', maxlength: 500 },
  detailedDescription: { type: String, default: '', maxlength: 20000 },
  displayType: {
    type: String,
    enum: ANNOUNCEMENT_DISPLAY_TYPES,
    default: 'banner',
  },
  priority: {
    type: String,
    enum: ANNOUNCEMENT_PRIORITIES,
    default: 'high',
  },
  content: {
    body: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    icon: { type: String, default: null },
  },
  ctas: { type: [CtaSchema], default: [] },
  remainingDays: { type: Number, default: null },
  trigger: {
    type: { type: String, enum: ANNOUNCEMENT_TRIGGERS, default: 'every_login' },
  },
  schedule: {
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    timezone: { type: String, default: 'UTC' },
  },
  userBehaviour: {
    dismissible: { type: Boolean, default: true },
    stickyBanner: { type: Boolean, default: true },
    autoCloseSeconds: { type: Number, default: null },
    showOnce: { type: Boolean, default: false },
    showEveryLogin: { type: Boolean, default: true },
    showDaily: { type: Boolean, default: false },
    requireAcknowledgement: { type: Boolean, default: false },
  },
  status: {
    type: String,
    enum: ANNOUNCEMENT_STATUSES,
    default: 'published',
    index: true,
  },
  source: {
    kind: {
      type: String,
      enum: ANNOUNCEMENT_SOURCE_KINDS,
      default: 'system_trial',
    },
    externalRef: { type: String, default: null },
  },
  criticalBypassOrgMute: { type: Boolean, default: false },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  publishedAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null },
  stats: {
    views: { type: Number, default: 0 },
    reads: { type: Number, default: 0 },
    dismissals: { type: Number, default: 0 },
    acknowledgements: { type: Number, default: 0 },
    ctaClicks: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

PlatformAnnouncementSchema.index(
  { targetOrganizationId: 1, templateKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      targetOrganizationId: { $type: 'objectId' },
      templateKey: { $type: 'string' },
    },
  },
);
PlatformAnnouncementSchema.index({ status: 1, 'schedule.startAt': 1 });
PlatformAnnouncementSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('PlatformAnnouncement', PlatformAnnouncementSchema);
module.exports.PLATFORM_ANNOUNCEMENT_CATEGORIES = PLATFORM_ANNOUNCEMENT_CATEGORIES;
