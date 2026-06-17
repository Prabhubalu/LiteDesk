'use strict';

const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const WebformSubmissionSchema = new Schema(
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
    fieldValues: {
      type: Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['processed', 'failed', 'duplicate_rejected', 'pending'],
      default: 'pending',
      index: true
    },
    crmOutcome: {
      moduleKey: { type: String, trim: true, lowercase: true },
      recordId: { type: Schema.Types.ObjectId, default: null },
      action: { type: String, enum: ['created', 'updated', 'skipped'], default: null }
    },
    dedupOutcome: {
      matched: { type: Boolean, default: false },
      matchedRecordId: { type: Schema.Types.ObjectId, default: null },
      action: { type: String, trim: true, default: null }
    },
    assignmentOutcome: {
      executed: { type: Boolean, default: false },
      reason: { type: String, trim: true, default: null },
      ownerChanged: { type: Boolean, default: false },
      newOwnerId: { type: Schema.Types.ObjectId, default: null },
      ruleId: { type: String, trim: true, default: null }
    },
    ipAddress: { type: String, trim: true, default: '' },
    userAgent: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, trim: true, default: '' },
    errorMessage: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

WebformSubmissionSchema.index({ organizationId: 1, webformId: 1, createdAt: -1 });
WebformSubmissionSchema.index(
  { organizationId: 1, webformId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: 'string', $exists: true, $ne: '' }
    }
  }
);

module.exports = wrapTenantModel(mongoose.model('WebformSubmission', WebformSubmissionSchema));
