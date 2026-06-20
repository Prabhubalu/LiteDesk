const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentPresenceSessionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    activityType: {
      type: String,
      enum: ['editing', 'viewing', 'idle'],
      default: 'viewing',
      index: true
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

DocumentPresenceSessionSchema.index(
  { organizationId: 1, documentId: 1, userId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('DocumentPresenceSession', DocumentPresenceSessionSchema));
