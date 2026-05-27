const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomMessageEventSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    eventType: { type: String, required: true, trim: true, index: true },
    eventId: { type: String, required: true, trim: true, unique: true },
    channel: { type: String, trim: true, default: 'email' },
    rawPayloadId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomRawPayload',
      default: null,
      index: true
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomConversation',
      default: null,
      index: true
    },
    mailroomMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomMessage',
      default: null
    },
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      default: null,
      index: true
    },
    dispatched: { type: Boolean, default: false },
    payload: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'mailroom_message_events' }
);

MailroomMessageEventSchema.index({ organizationId: 1, createdAt: -1 });
MailroomMessageEventSchema.index({ organizationId: 1, eventType: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.models.MailroomMessageEvent
    || mongoose.model('MailroomMessageEvent', MailroomMessageEventSchema)
);
