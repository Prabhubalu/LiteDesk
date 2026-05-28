const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const ItemBundleComponentSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  bundleVariantId: {
    type: Schema.Types.ObjectId,
    ref: 'ItemVariant',
    required: true,
    index: true
  },
  componentVariantId: {
    type: Schema.Types.ObjectId,
    ref: 'ItemVariant',
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.0001,
    default: 1
  },
  isOptional: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

ItemBundleComponentSchema.index(
  { organizationId: 1, bundleVariantId: 1, componentVariantId: 1 },
  { unique: true }
);
ItemBundleComponentSchema.index({ organizationId: 1, bundleVariantId: 1, sortOrder: 1 });

module.exports = wrapTenantModel(mongoose.model('ItemBundleComponent', ItemBundleComponentSchema));
