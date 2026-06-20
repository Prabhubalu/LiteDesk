const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentVersionSchema = new Schema(
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
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true
    },
    parentVersionId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentVersion',
      default: null
    },
    checksum: {
      type: String,
      trim: true,
      default: null
    },
    storagePath: {
      type: String,
      trim: true,
      default: null
    },
    richContent: {
      type: Schema.Types.Mixed,
      default: null
    },
    fileSizeBytes: {
      type: Number,
      default: null
    },
    mimeType: {
      type: String,
      trim: true,
      default: null
    },
    fileType: {
      type: String,
      trim: true,
      default: null
    },
    changeSummary: {
      type: String,
      trim: true,
      default: null
    },
    basedOnVersion: {
      type: Number,
      default: null,
      min: 1
    },
    resultingVersion: {
      type: Number,
      default: null,
      min: 1
    },
    conflictDetected: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DocumentVersionSchema.index(
  { organizationId: 1, documentId: 1, versionNumber: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('DocumentVersion', DocumentVersionSchema));
