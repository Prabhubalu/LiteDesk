'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TelephonyCallNoteSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelephonyCall',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    notes: { type: String, trim: true, default: '' },
    disposition: { type: String, trim: true, default: null },
    followUpDate: { type: Date, default: null },
    nextAction: { type: String, trim: true, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'telephony_call_notes',
  }
);

TelephonyCallNoteSchema.index({ organizationId: 1, callId: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('TelephonyCallNote', TelephonyCallNoteSchema));
