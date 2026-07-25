'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { REVISION_REASONS } = require('../services/astraStudio/constants');

const AstraCanvasRevisionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    canvasId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AstraCanvas',
      required: true,
      index: true,
    },
    versionNumber: { type: Number, required: true, min: 1 },
    title: { type: String, trim: true, required: true },
    yjsState: { type: Buffer, required: true },
    yjsStateHash: { type: String, trim: true, required: true },
    reason: {
      type: String,
      enum: REVISION_REASONS,
      default: 'checkpoint',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AstraCanvasRevisionSchema.index({ canvasId: 1, versionNumber: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.model('AstraCanvasRevision', AstraCanvasRevisionSchema)
);
