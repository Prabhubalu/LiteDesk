const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentVersionConflictSchema = new Schema(
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
    baseVersion: {
      type: Number,
      required: true,
      min: 1
    },
    currentVersion: {
      type: Number,
      required: true,
      min: 1
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolution: {
      type: String,
      enum: ['pending', 'create_anyway', 'cancelled'],
      default: 'pending',
      index: true
    },
    resultingVersion: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

DocumentVersionConflictSchema.index({ organizationId: 1, documentId: 1, createdAt: -1 });

module.exports = wrapTenantModel(mongoose.model('DocumentVersionConflict', DocumentVersionConflictSchema));
