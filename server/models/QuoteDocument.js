const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const QuoteDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true },
    quoteNumber: { type: String, trim: true, required: true, index: true },
    revisionNumber: { type: Number, required: true, min: 1, index: true },

    versionNumber: { type: Number, required: true, min: 1, index: true },
    status: { type: String, trim: true, default: 'generated', index: true }, // generated | revoked

    templateId: { type: String, default: 'default', index: true },
    checksum: { type: String, trim: true, default: null, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Storage
    mimeType: { type: String, trim: true, default: 'application/pdf' },
    storageProvider: { type: String, trim: true, default: 'local' }, // local | s3 | etc
    filePath: { type: String, trim: true, required: true },
    fileSizeBytes: { type: Number, default: null },

    // Snapshot metadata (for display; PDF content is derived from quote+lines snapshots)
    currency: { type: String, trim: true, default: 'USD' },
    grandTotal: { type: Number, default: 0 },
    lineCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

QuoteDocumentSchema.index({ organizationId: 1, quoteId: 1, revisionNumber: 1, versionNumber: -1 });

module.exports = wrapTenantModel(mongoose.model('QuoteDocument', QuoteDocumentSchema));

