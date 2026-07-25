'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const AstraCanvasSuggestionSchema = new mongoose.Schema(
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
    message: { type: String, trim: true, required: true, maxlength: 1000 },
    actionType: { type: String, trim: true, default: null },
    actionPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    triggerEventType: { type: String, trim: true, default: null },
    triggerEntityId: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'dismissed'],
      default: 'pending',
      index: true,
    },
    createdBy: { type: String, default: 'system' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AstraCanvasSuggestionSchema.index({ canvasId: 1, status: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.model('AstraCanvasSuggestion', AstraCanvasSuggestionSchema)
);
