const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

/**
 * Org-level default tax rules. Auto-apply on document create; override by permission.
 */
const OrganizationTaxSettingsSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true
  },
  defaultPurchaseTaxIds: [{ type: Schema.Types.ObjectId, ref: 'Tax' }],
  defaultSalesTaxIds: [{ type: Schema.Types.ObjectId, ref: 'Tax' }],
  defaultItemTaxIds: [{ type: Schema.Types.ObjectId, ref: 'Tax' }],
  defaultServiceTaxIds: [{ type: Schema.Types.ObjectId, ref: 'Tax' }],
  defaultPurchaseTaxGroupId: { type: Schema.Types.ObjectId, ref: 'TaxGroup', default: null },
  defaultSalesTaxGroupId: { type: Schema.Types.ObjectId, ref: 'TaxGroup', default: null },
  modifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = wrapTenantModel(
  mongoose.model('OrganizationTaxSettings', OrganizationTaxSettingsSchema)
);
