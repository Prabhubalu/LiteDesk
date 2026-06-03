const mongoose = require('mongoose');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const { Schema } = mongoose;

/**
 * Q8 Conversion contract stub.
 * Quotes must provide traceability without importing any target module models.
 */
const QuoteConversionLinkSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', required: true, index: true },
    quoteNumber: { type: String, trim: true, required: true, index: true },
    revisionNumber: { type: Number, required: true, min: 1, index: true },

    // Schema-ready for partial/split conversion; MVP uses 'full'
    conversionType: { type: String, trim: true, default: 'full', index: true }, // full | partial | split

    // Target is intentionally generic to avoid coupling.
    targetModuleKey: { type: String, trim: true, default: 'sales_orders', index: true },
    targetRecordId: { type: String, trim: true, default: null, index: true },
    targetExternalRef: { type: Schema.Types.Mixed, default: null }, // future: { provider, id } etc

    status: { type: String, trim: true, default: 'created', index: true }, // created | linked | failed

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    convertedAt: { type: Date, default: Date.now, index: true },

    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

QuoteConversionLinkSchema.index({ organizationId: 1, quoteId: 1, revisionNumber: 1 });
QuoteConversionLinkSchema.index(
  { organizationId: 1, quoteId: 1, revisionNumber: 1, targetRecordId: 1 },
  { unique: true, partialFilterExpression: { targetRecordId: { $type: 'string' } } }
);

module.exports = wrapTenantModel(mongoose.model('QuoteConversionLink', QuoteConversionLinkSchema));

