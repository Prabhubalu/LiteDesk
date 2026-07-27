'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const TallyTaxMappingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    companyGuid: { type: String, trim: true, default: null, index: true },
    tallyLedgerName: { type: String, required: true, trim: true },
    tallyDutyHead: { type: String, trim: true, default: null },
    arivuTaxCode: { type: String, trim: true, default: null },
    arivuTaxRatePercent: { type: Number, default: null },
    arivuTaxId: { type: Schema.Types.ObjectId, default: null },
    active: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

TallyTaxMappingSchema.index(
  { organizationId: 1, companyGuid: 1, tallyLedgerName: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('TallyTaxMapping', TallyTaxMappingSchema));
