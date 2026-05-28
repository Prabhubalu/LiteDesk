const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { slugifyCatalogKey } = require('../constants/catalogAttributeTypes');

const CatalogCategorySchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    trim: true,
    index: true
  },
  parentId: {
    type: Schema.Types.ObjectId,
    ref: 'CatalogCategory',
    default: null,
    index: true
  },
  /** Materialized path e.g. /electronics/phones */
  path: {
    type: String,
    trim: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

CatalogCategorySchema.index({ organizationId: 1, parentId: 1, sortOrder: 1 });
CatalogCategorySchema.index(
  { organizationId: 1, path: 1 },
  { unique: true, sparse: true }
);

CatalogCategorySchema.pre('validate', function preValidate(next) {
  if (!this.slug && this.name) {
    this.slug = slugifyCatalogKey(this.name);
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('CatalogCategory', CatalogCategorySchema));
