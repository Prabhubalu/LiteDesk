'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const Schema = mongoose.Schema;

const PROVIDERS = ['google', 'microsoft'];

const userCalendarConnectionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true
    },
    encryptedRefreshToken: { type: String, default: '' },
    accountEmail: { type: String, default: '', trim: true, lowercase: true },
    connectedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

userCalendarConnectionSchema.index(
  { organizationId: 1, userId: 1, provider: 1 },
  { unique: true }
);

userCalendarConnectionSchema.methods.isConnected = function isConnected() {
  return !!(this.encryptedRefreshToken && String(this.encryptedRefreshToken).trim());
};

module.exports = wrapTenantModel(
  mongoose.model('UserCalendarConnection', userCalendarConnectionSchema)
);
module.exports.PROVIDERS = PROVIDERS;
