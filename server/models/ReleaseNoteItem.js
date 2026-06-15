'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { RELEASE_NOTE_ITEM_TYPES } = require('../constants/releaseNoteConstants');

const releaseNoteItemSchema = new Schema({
  releaseNoteId: {
    type: Schema.Types.ObjectId,
    ref: 'ReleaseNote',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: RELEASE_NOTE_ITEM_TYPES
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    required: false,
    default: '',
    trim: true,
    maxlength: 4000
  },
  imageUrl: {
    type: String,
    default: null,
    trim: true
  },
  ctaLabel: {
    type: String,
    default: null,
    trim: true,
    maxlength: 40
  },
  ctaUrl: {
    type: String,
    default: null,
    trim: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

releaseNoteItemSchema.index({ releaseNoteId: 1, sortOrder: 1 });

module.exports = mongoose.model('ReleaseNoteItem', releaseNoteItemSchema);
