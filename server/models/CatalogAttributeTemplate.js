const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { CATALOG_ATTRIBUTE_DATA_TYPES } = require('../constants/catalogAttributeTypes');
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const { slugifyCatalogKey } = require('../constants/catalogAttributeTypes');

const CatalogAttributeTemplateSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'CatalogCategory',
    required: true,
    index: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  dataType: {
    type: String,
    enum: CATALOG_ATTRIBUTE_DATA_TYPES,
    required: true,
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true
  }],
  unit: {
    type: String,
    trim: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
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

CatalogAttributeTemplateSchema.index({ organizationId: 1, categoryId: 1, sortOrder: 1 });
CatalogAttributeTemplateSchema.index(
  { organizationId: 1, categoryId: 1, key: 1 },
  { unique: true }
);

CatalogAttributeTemplateSchema.pre('validate', function preValidate(next) {
  if (!this.key && this.label) {
    this.key = slugifyCatalogKey(this.label);
  }
  next();
});

module.exports = wrapTenantModel(mongoose.model('CatalogAttributeTemplate', CatalogAttributeTemplateSchema));
