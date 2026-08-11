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
  /** true = Flexible optional add-on; false = always included (mandatory) */
  isOptional: {
    type: Boolean,
    default: false
  },
  /** For optional components: pre-selected when configuring the bundle */
  defaultSelected: {
    type: Boolean,
    default: false
  },
  /** Allow sales users to change component qty at quote/SO time */
  editableQuantity: {
    type: Boolean,
    default: false
  },
  minQuantity: {
    type: Number,
    min: 0.0001,
    default: null
  },
  maxQuantity: {
    type: Number,
    min: 0.0001,
    default: null
  },
  remarks: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
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
