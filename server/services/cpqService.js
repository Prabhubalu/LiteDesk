/**
 * CPQ Item Groups — template → attribute matrix → generate Item/ItemVariant records.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { wrapTenantModel } = require('../utils/tenantModelProxy');
const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');

const AttributeSchema = new Schema({
  name: { type: String, required: true, trim: true },
  attributeType: { type: String, default: 'dropdown' },
  values: { type: [String], default: [] },
  isVariantAttribute: { type: Boolean, default: true },
  required: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 }
}, { _id: false });

const ItemGroupSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: null },
  category: { type: String, trim: true, default: null },
  brand: { type: String, trim: true, default: null },
  description: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  attributes: { type: [AttributeSchema], default: [] },
  effectiveFrom: { type: Date, default: null },
  effectiveUntil: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

ItemGroupSchema.index({ organizationId: 1, name: 1 }, { unique: true });

const ItemGroup = wrapTenantModel(mongoose.model('ItemGroup', ItemGroupSchema));

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function cartesian(attrs) {
  const variantAttrs = (attrs || []).filter((a) => a.isVariantAttribute !== false && Array.isArray(a.values) && a.values.length);
  if (!variantAttrs.length) return [[]];
  return variantAttrs.reduce((acc, attr) => {
    const next = [];
    for (const combo of acc) {
      for (const val of attr.values) {
        next.push([...combo, { name: attr.name, value: val }]);
      }
    }
    return next;
  }, [[]]);
}

function comboKey(combo) {
  return combo.map((c) => `${c.name}=${c.value}`).join('|');
}

function comboLabel(groupName, combo) {
  if (!combo.length) return groupName;
  return `${groupName} - ${combo.map((c) => c.value).join(' - ')}`;
}

async function createItemGroup({ organizationId, userId, payload }) {
  const name = String(payload.name || '').trim();
  if (!name) throw validationError('Item group name is required');
  const doc = await ItemGroup.create({
    organizationId,
    name,
    code: payload.code || null,
    category: payload.category || null,
    brand: payload.brand || null,
    description: payload.description || null,
    status: payload.status || 'ACTIVE',
    attributes: payload.attributes || [],
    effectiveFrom: payload.effectiveFrom || null,
    effectiveUntil: payload.effectiveUntil || null,
    createdBy: userId,
    modifiedBy: userId
  });
  return doc.toObject();
}

async function updateItemGroup({ organizationId, id, userId, payload }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId });
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  for (const key of ['name', 'code', 'category', 'brand', 'description', 'status', 'attributes', 'effectiveFrom', 'effectiveUntil']) {
    if (payload[key] !== undefined) group[key] = payload[key];
  }
  group.modifiedBy = userId;
  await group.save();
  return group.toObject();
}

async function listItemGroups({ organizationId }) {
  return ItemGroup.find({ organizationId }).sort({ name: 1 }).lean();
}

async function getItemGroup({ organizationId, id }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId }).lean();
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  return group;
}

function previewVariants(group) {
  const combos = cartesian(group.attributes);
  return {
    count: combos.length,
    variants: combos.map((combo) => ({
      key: comboKey(combo),
      name: comboLabel(group.name, combo),
      attributes: combo
    }))
  };
}

async function generateVariants({ organizationId, id, userId }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId });
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  const preview = previewVariants(group);
  const existing = await Item.find({
    organizationId,
    itemGroupId: group._id,
    deletedAt: null
  }).select('item_name attributeValues').lean();

  const existingKeys = new Set(
    (existing || []).map((item) => {
      const attrs = item.attributeValues || {};
      const combo = Object.keys(attrs).sort().map((k) => ({ name: k, value: attrs[k] }));
      return comboKey(combo);
    })
  );

  const created = [];
  for (const variant of preview.variants) {
    if (existingKeys.has(variant.key)) continue;
    const attributeValues = {};
    for (const a of variant.attributes) attributeValues[a.name] = a.value;

    // No multi-doc transaction: safe on standalone Mongo (local) and replica sets.
    // Re-runs are idempotent via existingKeys / itemGroupId attribute fingerprint.
    const item = await Item.create({
      organizationId,
      item_name: variant.name,
      description: group.description,
      category: group.category,
      attributeValues,
      itemGroupId: group._id,
      status: 'Active',
      assignedTo: userId,
      createdBy: userId,
      modifiedBy: userId
    });

    await ItemVariant.create({
      organizationId,
      itemId: item._id,
      variant_code: null,
      attributeValues,
      itemGroupId: group._id,
      lifecycle_state: 'Active',
      createdBy: userId,
      modifiedBy: userId
    });

    created.push({ itemId: item._id, name: variant.name, key: variant.key });
  }

  return { previewCount: preview.count, createdCount: created.length, created };
}

/** Product configuration validation (options + rules) */
const ProductConfigurationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true },
  itemGroupId: { type: Schema.Types.ObjectId, ref: 'ItemGroup', required: true },
  description: String,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  options: { type: [Schema.Types.Mixed], default: [] },
  productRules: { type: [Schema.Types.Mixed], default: [] },
  compatibilityRules: { type: [Schema.Types.Mixed], default: [] },
  dependencyRules: { type: [Schema.Types.Mixed], default: [] },
  version: { type: Number, default: 1 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const ProductConfiguration = wrapTenantModel(
  mongoose.model('ProductConfiguration', ProductConfigurationSchema)
);

function validateConfiguration(config, selections = {}) {
  const errors = [];
  const options = config.options || [];
  for (const opt of options) {
    const val = selections[opt.optionName || opt.name];
    if (opt.required && (val === undefined || val === null || val === '' || (Array.isArray(val) && !val.length))) {
      errors.push({ code: 'MANDATORY', message: `${opt.optionName || opt.name} is mandatory` });
    }
  }
  for (const rule of config.productRules || []) {
    if (rule.type === 'max' && rule.optionName) {
      const val = selections[rule.optionName];
      const count = Array.isArray(val) ? val.length : val ? 1 : 0;
      if (count > Number(rule.max || 1)) {
        errors.push({ code: 'MAX_SELECTION', message: `Maximum ${rule.max} for ${rule.optionName}` });
      }
    }
    if (rule.type === 'min' && rule.optionName) {
      const val = selections[rule.optionName];
      const count = Array.isArray(val) ? val.length : val ? 1 : 0;
      if (count < Number(rule.min || 1)) {
        errors.push({ code: 'MIN_SELECTION', message: `Minimum ${rule.min} for ${rule.optionName}` });
      }
    }
  }
  for (const rule of config.compatibilityRules || []) {
    const a = selections[rule.optionA];
    const b = selections[rule.optionB];
    if (a && b && Array.isArray(rule.incompatible) && rule.incompatible.some((pair) => pair[0] === a && pair[1] === b)) {
      errors.push({ code: 'INCOMPATIBLE', message: `${a} is not compatible with ${b}` });
    }
  }
  const appliedDependencies = [];
  for (const rule of config.dependencyRules || []) {
    const trigger = selections[rule.whenOption];
    const triggerMatch = Array.isArray(rule.whenValues)
      ? rule.whenValues.includes(trigger)
      : trigger === rule.whenValue;
    if (triggerMatch) {
      if (rule.requireOption && !selections[rule.requireOption]) {
        errors.push({ code: 'DEPENDENCY', message: `${rule.requireOption} is required` });
      }
      if (rule.addOption && rule.addValue) {
        appliedDependencies.push({ option: rule.addOption, value: rule.addValue });
      }
    }
  }
  return { valid: errors.length === 0, errors, appliedDependencies };
}

/** Simple pricing engine: base → rules → promotions */
function calculatePrice({ basePrice, quantity = 1, rules = [], promotions = [] }) {
  let price = Number(basePrice) || 0;
  const applied = [];
  for (const rule of rules) {
    if (rule.type === 'volume' && quantity >= Number(rule.minQty || 0)) {
      const discount = rule.discountPercent != null
        ? (price * Number(rule.discountPercent)) / 100
        : Number(rule.discountAmount) || 0;
      price = Math.max(0, price - discount);
      applied.push({ kind: 'rule', ...rule, discount });
    }
    if (rule.type === 'contract' && rule.contractPrice != null) {
      price = Number(rule.contractPrice);
      applied.push({ kind: 'rule', ...rule });
    }
  }
  for (const promo of promotions) {
    const now = Date.now();
    if (promo.effectiveFrom && new Date(promo.effectiveFrom).getTime() > now) continue;
    if (promo.effectiveUntil && new Date(promo.effectiveUntil).getTime() < now) continue;
    if (promo.type === 'percent') {
      const discount = (price * Number(promo.value)) / 100;
      price = Math.max(0, price - discount);
      applied.push({ kind: 'promotion', ...promo, discount });
    } else if (promo.type === 'amount') {
      price = Math.max(0, price - Number(promo.value));
      applied.push({ kind: 'promotion', ...promo, discount: Number(promo.value) });
    }
  }
  return { unitPrice: Math.round(price * 100) / 100, applied };
}

module.exports = {
  ItemGroup,
  ProductConfiguration,
  createItemGroup,
  updateItemGroup,
  listItemGroups,
  getItemGroup,
  previewVariants,
  generateVariants,
  validateConfiguration,
  calculatePrice,
  cartesian,
  comboKey
};
