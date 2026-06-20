/**
 * Person file attachments stored outside the People document (People schema has no embedded attachments).
 */
const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { Schema } = mongoose;

const PersonFileAttachmentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    personId: { type: Schema.Types.ObjectId, ref: 'People', required: true, index: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    storagePath: { type: String, required: true },
    uploaded_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    created_at: { type: Date, default: Date.now },
    appContext: { type: String },
    migratedDocumentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null, index: true }
  },
  { timestamps: false }
);

PersonFileAttachmentSchema.index({ organizationId: 1, personId: 1, created_at: -1 });

module.exports = wrapTenantModel(mongoose.model('PersonFileAttachment', PersonFileAttachmentSchema));
