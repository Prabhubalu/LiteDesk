const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

const InvoiceDocumentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, trim: true, required: true, index: true },
    invoiceType: { type: String, trim: true, default: 'standard', index: true },

    sourceInvoiceId: { type: String, trim: true, default: null, index: true },
    creditReason: { type: String, trim: true, default: null },

    versionNumber: { type: Number, required: true, min: 1, index: true },
    status: { type: String, trim: true, default: 'generated', index: true },

    templateId: { type: String, default: 'default', index: true },
    checksum: { type: String, trim: true, default: null, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    mimeType: { type: String, trim: true, default: 'application/pdf' },
    storageProvider: { type: String, trim: true, default: 'local' },
    filePath: { type: String, trim: true, required: true },
    fileSizeBytes: { type: Number, default: null },

    currency: { type: String, trim: true, default: 'USD' },
    grandTotal: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    lineCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

InvoiceDocumentSchema.index({ organizationId: 1, invoiceId: 1, versionNumber: -1 });

module.exports = wrapTenantModel(mongoose.model('InvoiceDocument', InvoiceDocumentSchema));
