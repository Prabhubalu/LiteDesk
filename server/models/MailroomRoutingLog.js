const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const MailroomRoutingLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    rawPayloadId: { type: Schema.Types.ObjectId, ref: 'MailroomRawPayload', default: null },
    messageId: { type: Schema.Types.ObjectId, ref: 'MailroomMessage', default: null },
    conversationId: { type: Schema.Types.ObjectId, ref: 'MailroomConversation', default: null },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    channel: { type: String, trim: true, default: '' },
    connectorType: { type: String, trim: true, default: '' },
    adapterAction: { type: String, trim: true, default: '' },
    adapterReason: { type: String, trim: true, default: '' },
    executed: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
    planTrace: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true, collection: 'mailroom_routing_logs' }
);

MailroomRoutingLogSchema.index({ organizationId: 1, createdAt: -1 });
MailroomRoutingLogSchema.index({ organizationId: 1, caseId: 1, createdAt: -1 });

module.exports = wrapTenantModel(
  mongoose.models.MailroomRoutingLog
    || mongoose.model('MailroomRoutingLog', MailroomRoutingLogSchema)
);
