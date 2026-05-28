const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomMessageSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomConversation',
      required: true,
      index: true
    },
    rawPayloadId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomRawPayload',
      default: null
    },
    channel: { type: String, trim: true, required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    externalMessageId: { type: String, trim: true, default: null, index: true },
    threadId: { type: String, trim: true, default: null },
    inReplyTo: { type: String, trim: true, default: null },
    references: { type: String, trim: true, default: null },
    subject: { type: String, trim: true, default: '' },
    body: { type: String, default: '' },
    htmlBody: { type: String, default: null },
    participants: { type: Schema.Types.Mixed, default: {} },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'MailroomAttachment' }],
    linkedCaseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    linkedCommunicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Communication',
      default: null
    },
    receivedAt: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'mailroom_messages' }
);

MailroomMessageSchema.index({ organizationId: 1, externalMessageId: 1 });
MailroomMessageSchema.index({ organizationId: 1, linkedCaseId: 1, receivedAt: 1 });
MailroomMessageSchema.index(
  {
    subject: 'text',
    body: 'text',
    externalMessageId: 'text'
  },
  {
    name: 'mailroom_message_text',
    weights: { subject: 5, externalMessageId: 3, body: 1 }
  }
);

module.exports = wrapTenantModel(
  mongoose.models.MailroomMessage
    || mongoose.model('MailroomMessage', MailroomMessageSchema)
);
