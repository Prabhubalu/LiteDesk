'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const FLOW_STATUSES = ['draft', 'published'];

const TelephonyIvrFlowSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, trim: true, required: true },
    status: { type: String, enum: FLOW_STATUSES, default: 'draft', index: true },
    nodes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
    publishedAt: { type: Date, default: null },
    providerCompiledMeta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: 'telephony_ivr_flows',
  }
);

TelephonyIvrFlowSchema.index({ organizationId: 1, name: 1 });

module.exports = wrapTenantModel(mongoose.model('TelephonyIvrFlow', TelephonyIvrFlowSchema));
module.exports.FLOW_STATUSES = FLOW_STATUSES;
