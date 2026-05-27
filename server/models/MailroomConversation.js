const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomConversationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    channel: { type: String, trim: true, required: true, index: true },
    externalThreadId: { type: String, trim: true, default: null, index: true },
    subject: { type: String, trim: true, default: '' },
    lastFromAddress: { type: String, trim: true, default: '' },
    lastSubject: { type: String, trim: true, default: '' },
    primaryCaseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null, index: true },
    relatedCaseIds: [{ type: Schema.Types.ObjectId, ref: 'Case' }],
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'People' }],
    status: {
      type: String,
      enum: ['open', 'closed', 'archived'],
      default: 'open',
      index: true
    },
    lastMessageAt: { type: Date, default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'mailroom_conversations' }
);

MailroomConversationSchema.index({ organizationId: 1, channel: 1, externalThreadId: 1 });

module.exports = wrapTenantModel(
  mongoose.models.MailroomConversation
    || mongoose.model('MailroomConversation', MailroomConversationSchema)
);
