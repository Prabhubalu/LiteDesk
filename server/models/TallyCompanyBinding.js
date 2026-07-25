'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const TallyCompanyBindingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: 'TallyConnection',
      required: true,
      index: true,
    },
    companyGuid: { type: String, required: true, trim: true, index: true },
    companyName: { type: String, required: true, trim: true },
    financialYear: { type: String, trim: true, default: null },
    port: { type: Number, default: 9000 },
    /** Per-module source-of-truth map, e.g. { stock: 'tally', parties: 'arivu' }. */
    sourceOfTruth: { type: Schema.Types.Mixed, default: {} },
    enabled: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['discovered', 'active', 'paused', 'error'],
      default: 'discovered',
      index: true,
    },
    lastSyncAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyCompanyBindingSchema.index(
  { organizationId: 1, companyGuid: 1 },
  { unique: true }
);
TallyCompanyBindingSchema.index({ organizationId: 1, connectionId: 1 });

module.exports = wrapTenantModel(mongoose.model('TallyCompanyBinding', TallyCompanyBindingSchema));
