'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { RELEASE_NOTE_VIEW_SOURCES } = require('../constants/releaseNoteConstants');

const userReleaseViewSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  releaseNoteId: {
    type: Schema.Types.ObjectId,
    ref: 'ReleaseNote',
    required: true
  },
  viewedAt: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: RELEASE_NOTE_VIEW_SOURCES,
    default: 'help_center'
  }
}, {
  timestamps: false
});

userReleaseViewSchema.index({ userId: 1, releaseNoteId: 1 }, { unique: true });
userReleaseViewSchema.index({ userId: 1, viewedAt: -1 });
userReleaseViewSchema.index({ releaseNoteId: 1, viewedAt: -1 });

module.exports = mongoose.model('UserReleaseView', userReleaseViewSchema);
