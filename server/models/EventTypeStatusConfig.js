const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  STATUS_CATEGORIES,
  STATUS_CONFIGURABLE_TYPE_KEYS,
} = require('../domain/events/eventStatus');

/**
 * Per-tenant status vocabulary for non-audit event types.
 * Categories remain system-owned; values (labels) are admin-configurable.
 */
const statusValueSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, required: true, enum: [...STATUS_CATEGORIES] },
    color: { type: String, trim: true, default: '#6366F1' },
    order: { type: Number, default: 50 },
    isDefault: { type: Boolean, default: false },
    isSystem: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
  },
  { _id: false }
);

const eventTypeStatusConfigSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    eventTypeKey: {
      type: String,
      required: true,
      enum: [...STATUS_CONFIGURABLE_TYPE_KEYS],
      uppercase: true,
    },
    values: {
      type: [statusValueSchema],
      default: [],
    },
    modifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

eventTypeStatusConfigSchema.index(
  { organizationId: 1, eventTypeKey: 1 },
  { unique: true }
);

module.exports = wrapTenantModel(
  mongoose.model('EventTypeStatusConfig', eventTypeStatusConfigSchema)
);
