const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentFavoriteSchema = new Schema(
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
    }
  },
  { timestamps: true }
);

DocumentFavoriteSchema.index(
  { organizationId: 1, userId: 1, documentId: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(mongoose.model('DocumentFavorite', DocumentFavoriteSchema));
