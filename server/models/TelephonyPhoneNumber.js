'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { PROVIDER_KEYS } = require('./TelephonyProviderConfig');

const STATUS_VALUES = ['active', 'released'];

const TelephonyPhoneNumberSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    providerKey: { type: String, enum: PROVIDER_KEYS, required: true, index: true },
    phoneNumber: { type: String, trim: true, required: true, index: true },
    providerNumberSid: { type: String, trim: true, default: null, index: true },
    friendlyName: { type: String, trim: true, default: '' },
    capabilities: {
      voice: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    status: { type: String, enum: STATUS_VALUES, default: 'active', index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'telephony_phone_numbers',
  }
);

TelephonyPhoneNumberSchema.index({ organizationId: 1, phoneNumber: 1 });

module.exports = wrapTenantModel(
  mongoose.model('TelephonyPhoneNumber', TelephonyPhoneNumberSchema)
);
module.exports.STATUS_VALUES = STATUS_VALUES;
