'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const AstraCanvasCommentSchema = new mongoose.Schema(
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
    widgetId: { type: String, trim: true, default: null },
    anchorX: { type: Number, default: null },
    anchorY: { type: Number, default: null },
    body: { type: String, trim: true, required: true, maxlength: 4000 },
    mentionUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isAi: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AstraCanvasCommentSchema.index({ canvasId: 1, deletedAt: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.model('AstraCanvasComment', AstraCanvasCommentSchema)
);
