'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const ConnectorConflictSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    connectorKey: { type: String, required: true, trim: true, lowercase: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    companyGuid: { type: String, trim: true, default: null },
    arivuId: { type: String, trim: true, default: null, index: true },
    externalId: { type: String, trim: true, default: null, index: true },
    status: {
      type: String,
      enum: ['open', 'resolved', 'ignored'],
      default: 'open',
      index: true,
    },
    reason: { type: String, trim: true, default: null },
    leftSnapshot: { type: Schema.Types.Mixed, default: null },
    rightSnapshot: { type: Schema.Types.Mixed, default: null },
    resolution: {
      type: String,
      enum: ['use_arivu', 'use_external', 'merge', 'ignore'],
      default: null,
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ConnectorConflictSchema.index({ organizationId: 1, connectorKey: 1, status: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('ConnectorConflict', ConnectorConflictSchema));
