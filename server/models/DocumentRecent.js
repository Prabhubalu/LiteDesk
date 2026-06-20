const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentRecentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

DocumentRecentSchema.index(
  { organizationId: 1, userId: 1, documentId: 1 },
  { unique: true }
);
DocumentRecentSchema.index({ organizationId: 1, userId: 1, lastViewedAt: -1 });

module.exports = wrapTenantModel(mongoose.model('DocumentRecent', DocumentRecentSchema));
