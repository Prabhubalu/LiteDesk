const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomRawPayloadSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    connectorType: {
      type: String,
      enum: ['arivu_parser', 'raw_mime_webhook', 'api', 'portal', 'chat', 'manual'],
      required: true
    },
    externalReference: { type: String, trim: true, default: null },
    contentType: { type: String, trim: true, default: 'application/json' },
    storageKey: { type: String, trim: true, default: null },
    /** Inline payload for M1 (base64); large blobs use storageKey in a later phase */
    payloadBase64: { type: String, default: null, select: false },
    payloadHash: { type: String, trim: true, index: true },
    headers: { type: Schema.Types.Mixed, default: {} },
    byteSize: { type: Number, default: 0 },
    parserInboundEventId: { type: Schema.Types.ObjectId, default: null },
    communicationId: { type: Schema.Types.ObjectId, ref: 'Communication', default: null },
    processingMeta: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed'],
      default: 'received',
      index: true
    },
    lastError: { type: String, trim: true, default: '', maxlength: 2000 },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'mailroom_raw_payloads' }
);

MailroomRawPayloadSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.models.MailroomRawPayload
    || mongoose.model('MailroomRawPayload', MailroomRawPayloadSchema)
);
