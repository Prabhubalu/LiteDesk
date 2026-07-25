const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const OrganizationChargeSettingsSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true,
    index: true
  },
  defaultPurchaseChargeIds: [{ type: Schema.Types.ObjectId, ref: 'Charge' }],
  defaultSalesChargeIds: [{ type: Schema.Types.ObjectId, ref: 'Charge' }],
  defaultItemChargeIds: [{ type: Schema.Types.ObjectId, ref: 'Charge' }],
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = wrapTenantModel(mongoose.model('OrganizationChargeSettings', OrganizationChargeSettingsSchema));
