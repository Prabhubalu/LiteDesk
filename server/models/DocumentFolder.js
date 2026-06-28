const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const DocumentFolderSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    name: {
      type: String,
      trim: true,
      required: true
    },
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: 'DocumentFolder',
      default: null,
      index: true
    },
    path: {
      type: String,
      trim: true,
      default: '/',
      index: true
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

DocumentFolderSchema.index({ organizationId: 1, parentFolderId: 1 });
DocumentFolderSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

module.exports = wrapTenantModel(mongoose.model('DocumentFolder', DocumentFolderSchema));
