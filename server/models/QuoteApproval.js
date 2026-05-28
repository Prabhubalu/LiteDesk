const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const QUOTE_APPROVAL_ACTIONS = [
  'submit',
  'approve',
  'reject'
];

const QuoteApprovalSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true },
    revisionNumber: { type: Number, required: true, min: 1, index: true },

    action: { type: String, enum: QUOTE_APPROVAL_ACTIONS, required: true, index: true },
    fromStatus: { type: String, trim: true, default: null },
    toStatus: { type: String, trim: true, default: null },

    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    comment: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

QuoteApprovalSchema.index({ organizationId: 1, quoteId: 1, createdAt: 1 });

module.exports = wrapTenantModel(mongoose.model('QuoteApproval', QuoteApprovalSchema));

