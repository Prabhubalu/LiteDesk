const mongoose = require('mongoose');
const { Schema } = mongoose;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const {
  PRICING_RULE_TYPES,
  PRICING_STATUSES,
  PRICING_ADJUSTMENT_TYPES,
  PRICING_CUSTOMER_TYPES,
} = require('../constants/pricingEngine');

const ScopeSchema = new Schema(
  {
    variantIds: [{ type: Schema.Types.ObjectId, ref: 'ItemVariant' }],
    itemIds: [{ type: Schema.Types.ObjectId, ref: 'Item' }],
    itemGroupIds: [{ type: Schema.Types.ObjectId }],
  },
  { _id: false }
);

const ConditionsSchema = new Schema(
  {
    minQty: { type: Number, default: null, min: 0 },
    maxQty: { type: Number, default: null, min: 0 },
    customerTypes: [{ type: String, enum: PRICING_CUSTOMER_TYPES }],
    regionCodes: [{ type: String, trim: true, uppercase: true }],
    channel: { type: String, trim: true, default: null },
    customerIds: [{ type: Schema.Types.ObjectId }],
  },
  { _id: false }
);

const AdjustmentSchema = new Schema(
  {
    type: { type: String, enum: PRICING_ADJUSTMENT_TYPES, required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const PricingRuleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: PRICING_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    ruleType: {
      type: String,
      enum: PRICING_RULE_TYPES,
      required: true,
      index: true,
    },
    priority: { type: Number, default: 100, index: true },
    effectiveFrom: { type: Date, default: null },
    effectiveUntil: { type: Date, default: null },
    scope: { type: ScopeSchema, default: () => ({}) },
    conditions: { type: ConditionsSchema, default: () => ({}) },
    adjustment: { type: AdjustmentSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

PricingRuleSchema.index({ organizationId: 1, name: 1 }, { unique: true });
PricingRuleSchema.index({ organizationId: 1, status: 1, priority: 1 });

module.exports = wrapTenantModel(mongoose.model('PricingRule', PricingRuleSchema));
