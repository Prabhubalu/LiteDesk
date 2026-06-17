'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { WEBFORM_FILE_SCAN_STATUSES } = require('../constants/webformFileFields');

const { Schema } = mongoose;

const WebformUploadSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    webformId: {
      type: Schema.Types.ObjectId,
      ref: 'Webform',
      required: true,
      index: true
    },
    uploadToken: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    fieldId: {
      type: String,
      trim: true,
      default: ''
    },
    storagePath: {
      type: String,
      trim: true,
      required: true
    },
    downloadUrl: {
      type: String,
      trim: true,
      default: ''
    },
    fileName: {
      type: String,
      trim: true,
      default: ''
    },
    mimeType: {
      type: String,
      trim: true,
      default: ''
    },
    fileSize: {
      type: Number,
      min: 0,
      default: 0
    },
    scanStatus: {
      type: String,
      enum: WEBFORM_FILE_SCAN_STATUSES,
      default: 'skipped'
    },
    scanMeta: {
      type: Schema.Types.Mixed,
      default: null
    },
    consumedAt: {
      type: Date,
      default: null
    },
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'WebformSubmission',
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    ipAddress: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { timestamps: true }
);

WebformUploadSchema.index({ organizationId: 1, webformId: 1, consumedAt: 1 });
WebformUploadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = wrapTenantModel(mongoose.model('WebformUpload', WebformUploadSchema));
