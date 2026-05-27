const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomProcessingFailureSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    rawPayloadId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomRawPayload',
      required: true,
      index: true
    },
    connectorType: {
      type: String,
      enum: ['arivu_parser', 'raw_mime_webhook', 'api', 'portal', 'chat', 'manual'],
      required: true
    },
    stage: { type: String, trim: true, default: 'pipeline' },
    errorMessage: { type: String, trim: true, default: '', maxlength: 2000 },
    errorStack: { type: String, default: '', select: false },
    retryCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['open', 'retrying', 'resolved', 'abandoned'],
      default: 'open',
      index: true
    },
    lastRetryAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'mailroom_processing_failures' }
);

MailroomProcessingFailureSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
MailroomProcessingFailureSchema.index({ rawPayloadId: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.models.MailroomProcessingFailure
    || mongoose.model('MailroomProcessingFailure', MailroomProcessingFailureSchema)
);
