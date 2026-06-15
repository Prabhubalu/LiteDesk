'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  RELEASE_NOTE_IMPORTANCE,
  RELEASE_NOTE_STATUS,
  RELEASE_NOTE_TARGET_APP_KEYS,
  RELEASE_NOTE_TARGET_PLANS
} = require('../constants/releaseNoteConstants');

const releaseNoteSchema = new Schema({
  version: {
    type: String,
    required: true,
    trim: true,
    maxlength: 32
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 120
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  summary: {
    type: String,
    required: false,
    default: '',
    trim: true,
    maxlength: 280
  },
  importance: {
    type: String,
    required: true,
    enum: RELEASE_NOTE_IMPORTANCE
  },
  status: {
    type: String,
    required: true,
    enum: RELEASE_NOTE_STATUS,
    default: 'draft'
  },
  targetApps: {
    type: [String],
    default: [],
    validate: {
      validator(values) {
        return (values || []).every((v) => RELEASE_NOTE_TARGET_APP_KEYS.includes(v));
      },
      message: 'Invalid targetApps value'
    }
  },
  targetPlans: {
    type: [String],
    default: [],
    validate: {
      validator(values) {
        return (values || []).every((v) => RELEASE_NOTE_TARGET_PLANS.includes(v));
      },
      message: 'Invalid targetPlans value'
    }
  },
  badgeExpiresAt: {
    type: Date,
    default: null
  },
  scheduledPublishAt: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  publishedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

releaseNoteSchema.index({ status: 1, publishedAt: -1 });
releaseNoteSchema.index({ slug: 1 }, { unique: true });
releaseNoteSchema.index({ status: 1, scheduledPublishAt: 1 });

module.exports = mongoose.model('ReleaseNote', releaseNoteSchema);
