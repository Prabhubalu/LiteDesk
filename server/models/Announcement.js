const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  ANNOUNCEMENT_DISPLAY_TYPES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
  ANNOUNCEMENT_TRIGGERS,
  ANNOUNCEMENT_CTA_ACTION_TYPES,
  ANNOUNCEMENT_SOURCE_KINDS,
  ANNOUNCEMENT_AUDIENCE_MODES,
} = require('../constants/announcementConstants');

const CtaSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true, maxlength: 40 },
  actionType: {
    type: String,
    enum: ANNOUNCEMENT_CTA_ACTION_TYPES,
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

const AnnouncementSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  shortDescription: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
  detailedDescription: {
    type: String,
    default: '',
    maxlength: 20000,
  },
  category: {
    type: String,
    trim: true,
    default: '',
    maxlength: 80,
  },
  tags: {
    type: [String],
    default: [],
  },
  displayType: {
    type: String,
    required: true,
    enum: ANNOUNCEMENT_DISPLAY_TYPES,
  },
  priority: {
    type: String,
    enum: ANNOUNCEMENT_PRIORITIES,
    default: 'medium',
  },
  content: {
    body: { type: String, default: '', maxlength: 20000 },
    imageUrl: { type: String, default: null, maxlength: 2000 },
    icon: { type: String, default: null, maxlength: 80 },
    youtubeUrl: { type: String, default: null, maxlength: 500 },
    attachments: {
      type: [{
        name: { type: String, trim: true, maxlength: 200, default: '' },
        url: { type: String, trim: true, maxlength: 2000, required: true },
        mime: { type: String, trim: true, maxlength: 120, default: null },
        size: { type: Number, default: null },
      }],
      default: [],
    },
  },
  ctas: {
    type: [CtaSchema],
    default: [],
  },
  audience: {
    mode: {
      type: String,
      enum: ANNOUNCEMENT_AUDIENCE_MODES,
      default: 'everyone',
    },
    segments: {
      type: [{
        type: { type: String, trim: true },
        values: { type: [String], default: [] },
      }],
      default: [],
    },
  },
  trigger: {
    type: {
      type: String,
      enum: ANNOUNCEMENT_TRIGGERS,
      default: 'immediate',
    },
  },
  schedule: {
    publishImmediately: { type: Boolean, default: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    timezone: { type: String, default: 'UTC', trim: true },
  },
  userBehaviour: {
    dismissible: { type: Boolean, default: true },
    stickyBanner: { type: Boolean, default: false },
    autoCloseSeconds: { type: Number, default: null },
    showOnce: { type: Boolean, default: false },
    showEveryLogin: { type: Boolean, default: false },
    showDaily: { type: Boolean, default: false },
    requireAcknowledgement: { type: Boolean, default: false },
  },
  status: {
    type: String,
    enum: ANNOUNCEMENT_STATUSES,
    default: 'draft',
    index: true,
  },
  source: {
    kind: {
      type: String,
      enum: ANNOUNCEMENT_SOURCE_KINDS,
      default: 'manual',
    },
    externalRef: { type: String, default: null },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  modifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  publishedAt: { type: Date, default: null },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  archivedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  resumedAt: { type: Date, default: null },
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

AnnouncementSchema.index({ organizationId: 1, status: 1, 'schedule.startAt': -1 });
AnnouncementSchema.index({ organizationId: 1, status: 1, 'schedule.endAt': 1 });
AnnouncementSchema.index({ organizationId: 1, displayType: 1, priority: 1 });
AnnouncementSchema.index({ organizationId: 1, createdBy: 1 });

module.exports = wrapTenantModel(mongoose.model('Announcement', AnnouncementSchema));
