'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentEditDraftSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    richContent: {
      type: Schema.Types.Mixed,
      default: null
    },
    richContentText: {
      type: String,
      trim: true,
      default: null
    },
    baseVersionNumber: {
      type: Number,
      default: 1,
      min: 1
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

DocumentEditDraftSchema.index({ organizationId: 1, documentId: 1, userId: 1 }, { unique: true });
DocumentEditDraftSchema.index({ organizationId: 1, documentId: 1, lastSavedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('DocumentEditDraft', DocumentEditDraftSchema));
