const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomAttachmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: [
        'uploaded',
        'linked',
        'failed',
        'deleted',
        'scan_pending',
        'scan_clean',
        'scan_infected',
        'scan_failed'
      ],
      default: 'uploaded',
      index: true
    },
    scanMeta: { type: Schema.Types.Mixed, default: null },
    storageDriver: { type: String, default: 'oci', trim: true },
    bucket: { type: String, required: true, trim: true },
    objectKey: { type: String, required: true, trim: true, index: true },
    originalFileName: { type: String, default: '', trim: true },
    mimeType: { type: String, default: 'application/octet-stream', trim: true },
    sizeBytes: { type: Number, default: 0 },
    sha256: { type: String, default: null, trim: true, index: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, default: 'mailroom', trim: true },
    linkedConversationId: { type: Schema.Types.ObjectId, ref: 'MailroomConversation', default: null, index: true },
    linkedMessageId: { type: Schema.Types.ObjectId, ref: 'MailroomMessage', default: null, index: true }
  },
  { timestamps: true, collection: 'mailroom_attachments' }
);

MailroomAttachmentSchema.index({ organizationId: 1, objectKey: 1 }, { unique: true });

module.exports = wrapTenantModel(
  mongoose.models.MailroomAttachment
    || mongoose.model('MailroomAttachment', MailroomAttachmentSchema)
);

