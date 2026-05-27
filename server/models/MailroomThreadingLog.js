const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomThreadingLogSchema = new Schema(
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
      default: null,
      index: true
    },
    mailroomMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomMessage',
      default: null,
      index: true
    },
    rawPayloadId: {
      type: Schema.Types.ObjectId,
      ref: 'MailroomRawPayload',
      default: null
    },
    matched: { type: Boolean, default: false },
    strategyId: { type: String, trim: true, default: '' },
    signal: { type: String, trim: true, default: '' },
    target: { type: Schema.Types.Mixed, default: null },
    trace: { type: [Schema.Types.Mixed], default: [] },
    fallback: { type: Schema.Types.Mixed, default: null },
    /** How the conversation was resolved after policy eval (new_conversation, threading_target, …). */
    resolution: { type: String, trim: true, default: '' }
  },
  { timestamps: true, collection: 'mailroom_threading_logs' }
);

MailroomThreadingLogSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.models.MailroomThreadingLog
    || mongoose.model('MailroomThreadingLog', MailroomThreadingLogSchema)
);
