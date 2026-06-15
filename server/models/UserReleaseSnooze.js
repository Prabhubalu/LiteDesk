'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userReleaseSnoozeSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  snoozedUntil: {
    type: Date,
    required: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('UserReleaseSnooze', userReleaseSnoozeSchema);
