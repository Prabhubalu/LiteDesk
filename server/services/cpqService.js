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

/** Stable fingerprint — attribute order must not affect matching. */
function comboKey(combo) {
  return (combo || [])
    .map((c) => ({ name: String(c?.name || '').trim(), value: String(c?.value ?? '').trim() }))
    .filter((c) => c.name)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('|');
}

function comboKeyFromAttributeValues(attributeValues) {
  if (!attributeValues || typeof attributeValues !== 'object') return '';
  return comboKey(
    Object.keys(attributeValues).map((name) => ({ name, value: attributeValues[name] }))
  );
}

function comboLabel(groupName, combo) {
  if (!combo.length) return groupName;
  return `${groupName} - ${combo.map((c) => c.value).join(' - ')}`;
}

function emptyGenerationStats(expected = 0) {
  return {
    expected,
    generated: 0,
    missing: expected,
    orphans: 0,
    itemsLinked: 0,
    state: expected === 0 ? 'empty' : 'none'
  };
}

function buildGenerationStats(group, items = []) {
  const combos = cartesian(group?.attributes);
  // cartesian returns [[]] when no attrs — treat as zero expected variants for generation UI
  const hasAttrs = (group?.attributes || []).some(
    (a) => a.isVariantAttribute !== false && Array.isArray(a.values) && a.values.length
  );
  const expectedCombos = hasAttrs ? combos : [];
  const expectedKeys = new Set(expectedCombos.map((combo) => comboKey(combo)));
  const expected = expectedCombos.length;

  const matchedKeys = new Set();
  let orphans = 0;
  for (const item of items) {
    const key = comboKeyFromAttributeValues(item.attributeValues);
    if (!key) {
      orphans += 1;
      continue;
    }
    if (expectedKeys.has(key)) matchedKeys.add(key);
    else orphans += 1;
  }

  const generated = matchedKeys.size;
  const missing = Math.max(0, expected - generated);
  let state = 'none';
  if (expected === 0) state = 'empty';
  else if (generated >= expected) state = 'complete';
  else if (generated > 0) state = 'partial';

  return {
    expected,
    generated,
    missing,
    orphans,
    itemsLinked: items.length,
    state,
    matchedKeys: [...matchedKeys]
  };
}

async function loadItemsForGroups({ organizationId, groupIds }) {
  if (!groupIds?.length) return [];
  return Item.find({
    organizationId,
    itemGroupId: { $in: groupIds },
    deletedAt: null
  })
    .select('_id itemGroupId item_name attributeValues')
    .lean();
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
  const obj = doc.toObject();
  return { ...obj, generation: emptyGenerationStats(buildGenerationStats(obj, []).expected) };
}

async function updateItemGroup({ organizationId, id, userId, payload }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId });
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  for (const key of ['name', 'code', 'category', 'brand', 'description', 'status', 'attributes', 'effectiveFrom', 'effectiveUntil']) {
    if (payload[key] !== undefined) group[key] = payload[key];
  }
  group.modifiedBy = userId;
  await group.save();
  const obj = group.toObject();
  const items = await loadItemsForGroups({ organizationId, groupIds: [group._id] });
  const generation = buildGenerationStats(obj, items);
  delete generation.matchedKeys;
  return { ...obj, generation };
}

async function listItemGroups({ organizationId }) {
  const groups = await ItemGroup.find({ organizationId }).sort({ name: 1 }).lean();
  if (!groups.length) return [];

  const items = await loadItemsForGroups({
    organizationId,
    groupIds: groups.map((g) => g._id)
  });
  const byGroup = new Map();
  for (const item of items) {
    const gid = String(item.itemGroupId);
    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid).push(item);
  }

  return groups.map((g) => {
    const generation = buildGenerationStats(g, byGroup.get(String(g._id)) || []);
    delete generation.matchedKeys;
    return { ...g, generation };
  });
}

async function getItemGroup({ organizationId, id }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId }).lean();
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  const items = await loadItemsForGroups({ organizationId, groupIds: [group._id] });
  const generation = buildGenerationStats(group, items);
  delete generation.matchedKeys;
  return { ...group, generation };
}

function previewVariants(group, existingItems = []) {
  const generation = buildGenerationStats(group, existingItems);
  const matched = new Set(generation.matchedKeys || []);
  delete generation.matchedKeys;
  const hasAttrs = (group?.attributes || []).some(
    (a) => a.isVariantAttribute !== false && Array.isArray(a.values) && a.values.length
  );
  const combos = hasAttrs ? cartesian(group.attributes) : [];
  const keyToItem = {};
  for (const item of existingItems) {
    const key = comboKeyFromAttributeValues(item.attributeValues);
    if (key && matched.has(key) && !keyToItem[key]) {
      keyToItem[key] = { itemId: item._id, itemName: item.item_name };
    }
  }
  return {
    count: combos.length,
    generation,
    variants: combos.map((combo) => {
      const key = comboKey(combo);
      const hit = keyToItem[key];
      return {
        key,
        name: comboLabel(group.name, combo),
        attributes: combo,
        exists: Boolean(hit),
        itemId: hit?.itemId || null,
        itemName: hit?.itemName || null
      };
    })
  };
}

async function previewItemGroupVariants({ organizationId, id }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId }).lean();
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  const items = await loadItemsForGroups({ organizationId, groupIds: [group._id] });
  return previewVariants(group, items);
}

async function generateVariants({ organizationId, id, userId }) {
  const group = await ItemGroup.findOne({ _id: id, organizationId });
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  const existing = await loadItemsForGroups({ organizationId, groupIds: [group._id] });
  const preview = previewVariants(group.toObject ? group.toObject() : group, existing);

  const existingKeys = new Set(
    (existing || [])
      .map((item) => comboKeyFromAttributeValues(item.attributeValues))
      .filter(Boolean)
  );

  const created = [];
  for (const variant of preview.variants) {
    if (existingKeys.has(variant.key)) continue;
    const attributeValues = {};
    for (const a of variant.attributes) attributeValues[a.name] = a.value;

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
    existingKeys.add(variant.key);
  }

  const afterItems = await loadItemsForGroups({ organizationId, groupIds: [group._id] });
  const generation = buildGenerationStats(group.toObject ? group.toObject() : group, afterItems);
  delete generation.matchedKeys;

  return {
    previewCount: preview.count,
    createdCount: created.length,
    skippedCount: preview.count - created.length,
    created,
    generation
  };
}

/** --------------------------------------------------------------------------
 * Product Configuration (CPQ) — options, product/compatibility/dependency rules,
 * version history, audit fields, and real-time validation for Quotes / SOs.
 * -------------------------------------------------------------------------- */

const OPTION_TYPES = ['dropdown', 'single_select', 'multi_select', 'checkbox'];
const PRODUCT_RULE_TYPES = ['mandatory', 'optional', 'min', 'max', 'quantity', 'validation'];
const COMPAT_MODES = ['compatible_with', 'incompatible_with'];
const DEPENDENCY_ACTIONS = ['require', 'add', 'enable', 'recommend'];

const ConfigOptionSchema = new Schema({
  optionName: { type: String, required: true, trim: true },
  optionType: { type: String, enum: OPTION_TYPES, default: 'dropdown' },
  required: { type: Boolean, default: false },
  defaultValue: { type: Schema.Types.Mixed, default: null },
  values: { type: [String], default: [] },
  displayOrder: { type: Number, default: 0 }
}, { _id: true });

const ProductRuleSchema = new Schema({
  type: { type: String, enum: PRODUCT_RULE_TYPES, required: true },
  optionName: { type: String, trim: true, default: null },
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  minQty: { type: Number, default: null },
  maxQty: { type: Number, default: null },
  message: { type: String, default: null }
}, { _id: true });

const CompatibilityRuleSchema = new Schema({
  optionA: { type: String, required: true, trim: true },
  optionB: { type: String, required: true, trim: true },
  mode: { type: String, enum: COMPAT_MODES, default: 'incompatible_with' },
  /** Pairs of [valueA, valueB] that are either allowed (compatible_with) or blocked */
  pairs: { type: [[String]], default: [] },
  /** Legacy field: treated as incompatible pairs */
  incompatible: { type: [[String]], default: [] },
  message: { type: String, default: null }
}, { _id: true });

const DependencyRuleSchema = new Schema({
  whenOption: { type: String, required: true, trim: true },
  whenValues: { type: [String], default: [] },
  whenValue: { type: String, default: null },
  action: { type: String, enum: DEPENDENCY_ACTIONS, default: 'require' },
  targetOption: { type: String, trim: true, default: null },
  targetValue: { type: String, default: null },
  /** Legacy aliases still accepted by validateConfiguration */
  requireOption: { type: String, trim: true, default: null },
  addOption: { type: String, trim: true, default: null },
  addValue: { type: String, default: null },
  message: { type: String, default: null }
}, { _id: true });

const VersionHistoryEntrySchema = new Schema({
  version: { type: Number, required: true },
  snapshot: { type: Schema.Types.Mixed, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  changedAt: { type: Date, default: Date.now },
  changeNote: { type: String, default: null }
}, { _id: false });

const ProductConfigurationSchema = new Schema({
  organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  itemGroupId: { type: Schema.Types.ObjectId, ref: 'ItemGroup', required: true, index: true },
  description: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  effectiveFrom: { type: Date, default: null },
  effectiveUntil: { type: Date, default: null },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  options: { type: [ConfigOptionSchema], default: [] },
  productRules: { type: [ProductRuleSchema], default: [] },
  compatibilityRules: { type: [CompatibilityRuleSchema], default: [] },
  dependencyRules: { type: [DependencyRuleSchema], default: [] },
  version: { type: Number, default: 1, min: 1 },
  versionHistory: { type: [VersionHistoryEntrySchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  modifiedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

ProductConfigurationSchema.index({ organizationId: 1, name: 1 }, { unique: true });
ProductConfigurationSchema.index({ organizationId: 1, itemGroupId: 1, status: 1 });

const ProductConfiguration = wrapTenantModel(
  mongoose.model('ProductConfiguration', ProductConfigurationSchema)
);

function selectionCount(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (Array.isArray(val)) return val.length;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return 1;
}

function isSelectionEmpty(val) {
  return selectionCount(val) === 0;
}

function selectionValues(val) {
  if (val === undefined || val === null || val === '') return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'boolean') return val ? ['true'] : [];
  return [String(val)];
}

function optionKey(opt) {
  return String(opt?.optionName || opt?.name || '').trim();
}

function normalizeOptions(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((opt, idx) => ({
    optionName: optionKey(opt),
    optionType: OPTION_TYPES.includes(opt.optionType) ? opt.optionType : 'dropdown',
    required: opt.required === true,
    defaultValue: opt.defaultValue ?? null,
    values: Array.isArray(opt.values) ? opt.values.map((v) => String(v).trim()).filter(Boolean) : [],
    displayOrder: Number.isFinite(Number(opt.displayOrder)) ? Number(opt.displayOrder) : idx
  })).filter((o) => o.optionName);
}

function normalizeProductRules(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((rule) => ({
    type: PRODUCT_RULE_TYPES.includes(rule.type) ? rule.type : 'validation',
    optionName: rule.optionName ? String(rule.optionName).trim() : null,
    min: rule.min != null ? Number(rule.min) : null,
    max: rule.max != null ? Number(rule.max) : null,
    minQty: rule.minQty != null ? Number(rule.minQty) : null,
    maxQty: rule.maxQty != null ? Number(rule.maxQty) : null,
    message: rule.message || null
  }));
}

function normalizeCompatibilityRules(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((rule) => {
    const pairs = Array.isArray(rule.pairs)
      ? rule.pairs
      : Array.isArray(rule.incompatible)
        ? rule.incompatible
        : [];
    return {
      optionA: String(rule.optionA || '').trim(),
      optionB: String(rule.optionB || '').trim(),
      mode: COMPAT_MODES.includes(rule.mode)
        ? rule.mode
        : (Array.isArray(rule.incompatible) ? 'incompatible_with' : 'incompatible_with'),
      pairs: pairs
        .filter((p) => Array.isArray(p) && p.length >= 2)
        .map((p) => [String(p[0]), String(p[1])]),
      incompatible: Array.isArray(rule.incompatible) ? rule.incompatible : [],
      message: rule.message || null
    };
  }).filter((r) => r.optionA && r.optionB);
}

function normalizeDependencyRules(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw.map((rule) => {
    const action = DEPENDENCY_ACTIONS.includes(rule.action)
      ? rule.action
      : (rule.requireOption ? 'require' : (rule.addOption ? 'add' : 'require'));
    const targetOption = rule.targetOption || rule.requireOption || rule.addOption || null;
    const targetValue = rule.targetValue != null ? rule.targetValue : (rule.addValue ?? null);
    const whenValues = Array.isArray(rule.whenValues)
      ? rule.whenValues.map(String)
      : (rule.whenValue != null ? [String(rule.whenValue)] : []);
    return {
      whenOption: String(rule.whenOption || '').trim(),
      whenValues,
      whenValue: rule.whenValue != null ? String(rule.whenValue) : null,
      action,
      targetOption: targetOption ? String(targetOption).trim() : null,
      targetValue,
      requireOption: rule.requireOption || (action === 'require' ? targetOption : null),
      addOption: rule.addOption || (action === 'add' ? targetOption : null),
      addValue: rule.addValue != null ? rule.addValue : (action === 'add' ? targetValue : null),
      message: rule.message || null
    };
  }).filter((r) => r.whenOption);
}

function configurationContentSnapshot(doc) {
  return {
    name: doc.name,
    itemGroupId: doc.itemGroupId,
    description: doc.description,
    status: doc.status,
    effectiveFrom: doc.effectiveFrom,
    effectiveUntil: doc.effectiveUntil,
    assignedTo: doc.assignedTo,
    options: doc.options || [],
    productRules: doc.productRules || [],
    compatibilityRules: doc.compatibilityRules || [],
    dependencyRules: doc.dependencyRules || []
  };
}

function contentFingerprint(doc) {
  return JSON.stringify({
    options: doc.options || [],
    productRules: doc.productRules || [],
    compatibilityRules: doc.compatibilityRules || [],
    dependencyRules: doc.dependencyRules || [],
    status: doc.status,
    name: doc.name,
    description: doc.description || null,
    itemGroupId: String(doc.itemGroupId || ''),
    effectiveFrom: doc.effectiveFrom || null,
    effectiveUntil: doc.effectiveUntil || null,
    assignedTo: doc.assignedTo ? String(doc.assignedTo) : null
  });
}

function isConfigEffective(config, asOf = new Date()) {
  const t = asOf.getTime();
  if (config.effectiveFrom && new Date(config.effectiveFrom).getTime() > t) return false;
  if (config.effectiveUntil && new Date(config.effectiveUntil).getTime() < t) return false;
  return true;
}

/**
 * Apply dependency `add` auto-fills then validate rules.
 * @returns {{ valid: boolean, errors: object[], appliedDependencies: object[], selections: object, disabledOptions: string[], recommended: object[] }}
 */
function validateConfiguration(config, selections = {}, { applyDependencies = true } = {}) {
  const errors = [];
  const recommended = [];
  const disabledOptions = [];
  let working = { ...selections };

  const appliedDependencies = [];
  const options = config.options || [];
  const optionByName = new Map(options.map((o) => [optionKey(o), o]));

  // Seed defaults when missing
  for (const opt of options) {
    const key = optionKey(opt);
    if (isSelectionEmpty(working[key]) && opt.defaultValue != null && opt.defaultValue !== '') {
      working[key] = opt.defaultValue;
    }
  }

  // Dependency application (auto-add values first)
  for (const rule of config.dependencyRules || []) {
    const triggerRaw = working[rule.whenOption];
    const triggerVals = selectionValues(triggerRaw);
    const whenSet = Array.isArray(rule.whenValues) && rule.whenValues.length
      ? rule.whenValues.map(String)
      : (rule.whenValue != null ? [String(rule.whenValue)] : []);
    const triggerMatch = whenSet.length
      ? triggerVals.some((v) => whenSet.includes(v))
      : triggerVals.length > 0;
    if (!triggerMatch) continue;

    const action = rule.action
      || (rule.requireOption ? 'require' : null)
      || (rule.addOption ? 'add' : 'require');
    const targetOption = rule.targetOption || rule.requireOption || rule.addOption;
    const targetValue = rule.targetValue != null ? rule.targetValue : rule.addValue;

    if (action === 'add' && targetOption && targetValue != null && applyDependencies) {
      const opt = optionByName.get(targetOption);
      if (opt?.optionType === 'multi_select') {
        const current = Array.isArray(working[targetOption]) ? [...working[targetOption]] : [];
        if (!current.includes(targetValue)) {
          current.push(targetValue);
          working[targetOption] = current;
          appliedDependencies.push({ action: 'add', option: targetOption, value: targetValue });
        }
      } else if (isSelectionEmpty(working[targetOption])) {
        working[targetOption] = targetValue;
        appliedDependencies.push({ action: 'add', option: targetOption, value: targetValue });
      }
    }
    if (action === 'enable' && targetOption) {
      appliedDependencies.push({ action: 'enable', option: targetOption, value: targetValue });
    }
    if (action === 'recommend' && targetOption) {
      recommended.push({
        option: targetOption,
        value: targetValue,
        message: rule.message || `${targetOption} is recommended`
      });
    }
  }

  // Mandatory options
  for (const opt of options) {
    const key = optionKey(opt);
    if (opt.required && isSelectionEmpty(working[key])) {
      errors.push({
        code: 'MANDATORY',
        optionName: key,
        message: `${key} is mandatory`
      });
    }
  }

  // Product rules
  for (const rule of config.productRules || []) {
    const name = rule.optionName;
    const msg = rule.message;
    if (rule.type === 'mandatory' && name && isSelectionEmpty(working[name])) {
      errors.push({ code: 'MANDATORY', optionName: name, message: msg || `${name} is mandatory` });
    }
    if (rule.type === 'max' && name) {
      const count = selectionCount(working[name]);
      const max = Number(rule.max ?? 1);
      if (count > max) {
        errors.push({ code: 'MAX_SELECTION', optionName: name, message: msg || `Maximum ${max} for ${name}` });
      }
    }
    if (rule.type === 'min' && name) {
      const count = selectionCount(working[name]);
      const min = Number(rule.min ?? 1);
      if (count < min) {
        errors.push({ code: 'MIN_SELECTION', optionName: name, message: msg || `Minimum ${min} for ${name}` });
      }
    }
    if (rule.type === 'quantity' && name) {
      const count = selectionCount(working[name]);
      if (rule.minQty != null && count < Number(rule.minQty)) {
        errors.push({ code: 'QTY_MIN', optionName: name, message: msg || `Minimum quantity ${rule.minQty} for ${name}` });
      }
      if (rule.maxQty != null && count > Number(rule.maxQty)) {
        errors.push({ code: 'QTY_MAX', optionName: name, message: msg || `Maximum quantity ${rule.maxQty} for ${name}` });
      }
    }
  }

  // Compatibility
  for (const rule of config.compatibilityRules || []) {
    const aVals = selectionValues(working[rule.optionA]);
    const bVals = selectionValues(working[rule.optionB]);
    if (!aVals.length || !bVals.length) continue;

    const pairs = (Array.isArray(rule.pairs) && rule.pairs.length
      ? rule.pairs
      : (Array.isArray(rule.incompatible) ? rule.incompatible : []))
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map((p) => [String(p[0]), String(p[1])]);

    const mode = rule.mode
      || (Array.isArray(rule.incompatible) && rule.incompatible.length ? 'incompatible_with' : 'incompatible_with');

    for (const a of aVals) {
      for (const b of bVals) {
        const matched = pairs.some((p) => p[0] === a && p[1] === b);
        if (mode === 'incompatible_with' && matched) {
          errors.push({
            code: 'INCOMPATIBLE',
            optionName: rule.optionB,
            message: rule.message || `${a} is not compatible with ${b}`
          });
        }
        if (mode === 'compatible_with' && pairs.length && !matched) {
          // Only enforce allowlist when a pair that involves this A value is defined
          const aHasAllowlist = pairs.some((p) => p[0] === a);
          if (aHasAllowlist) {
            errors.push({
              code: 'INCOMPATIBLE',
              optionName: rule.optionB,
              message: rule.message || `${b} is not compatible with ${a}`
            });
          }
        }
      }
    }
  }

  // Dependency require after auto-add
  for (const rule of config.dependencyRules || []) {
    const triggerVals = selectionValues(working[rule.whenOption]);
    const whenSet = Array.isArray(rule.whenValues) && rule.whenValues.length
      ? rule.whenValues.map(String)
      : (rule.whenValue != null ? [String(rule.whenValue)] : []);
    const triggerMatch = whenSet.length
      ? triggerVals.some((v) => whenSet.includes(v))
      : triggerVals.length > 0;
    if (!triggerMatch) continue;

    const action = rule.action
      || (rule.requireOption ? 'require' : null)
      || (rule.addOption ? 'add' : 'require');
    const targetOption = rule.targetOption || rule.requireOption || rule.addOption;
    const targetValue = rule.targetValue != null ? rule.targetValue : rule.addValue;

    if ((action === 'require' || rule.requireOption) && targetOption) {
      if (isSelectionEmpty(working[targetOption])) {
        errors.push({
          code: 'DEPENDENCY',
          optionName: targetOption,
          message: rule.message || `${targetOption} is required`
        });
      } else if (targetValue != null) {
        const vals = selectionValues(working[targetOption]);
        if (!vals.includes(String(targetValue))) {
          errors.push({
            code: 'DEPENDENCY',
            optionName: targetOption,
            message: rule.message || `${targetOption} must be ${targetValue}`
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    appliedDependencies,
    recommended,
    disabledOptions,
    selections: working
  };
}

async function listProductConfigurations({ organizationId, itemGroupId, status } = {}) {
  const filter = { organizationId };
  if (itemGroupId) filter.itemGroupId = itemGroupId;
  if (status) filter.status = status;
  const rows = await ProductConfiguration.find(filter)
    .sort({ updatedAt: -1 })
    .lean();
  return rows;
}

async function getProductConfiguration({ organizationId, id }) {
  const doc = await ProductConfiguration.findOne({ organizationId, _id: id }).lean();
  if (!doc) throw validationError('Product configuration not found', 'NOT_FOUND');
  return doc;
}

async function assertItemGroupBelongs({ organizationId, itemGroupId }) {
  const group = await ItemGroup.findOne({ organizationId, _id: itemGroupId }).select('_id name').lean();
  if (!group) throw validationError('Item group not found', 'NOT_FOUND');
  return group;
}

async function createProductConfiguration({ organizationId, userId, payload = {} }) {
  const name = String(payload.name || '').trim();
  if (!name) throw validationError('Configuration name is required');
  if (!payload.itemGroupId) throw validationError('Item group is required');
  await assertItemGroupBelongs({ organizationId, itemGroupId: payload.itemGroupId });

  try {
    const doc = await ProductConfiguration.create({
      organizationId,
      name,
      itemGroupId: payload.itemGroupId,
      description: payload.description || null,
      status: payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      effectiveFrom: payload.effectiveFrom || null,
      effectiveUntil: payload.effectiveUntil || null,
      assignedTo: payload.assignedTo || null,
      options: normalizeOptions(payload.options),
      productRules: normalizeProductRules(payload.productRules),
      compatibilityRules: normalizeCompatibilityRules(payload.compatibilityRules),
      dependencyRules: normalizeDependencyRules(payload.dependencyRules),
      version: 1,
      versionHistory: [],
      createdBy: userId,
      modifiedBy: userId
    });
    return doc.toObject ? doc.toObject() : doc;
  } catch (err) {
    if (err?.code === 11000) throw validationError('A product configuration with this name already exists');
    throw err;
  }
}

async function updateProductConfiguration({ organizationId, id, userId, payload = {}, changeNote = null }) {
  const existing = await ProductConfiguration.findOne({ organizationId, _id: id });
  if (!existing) throw validationError('Product configuration not found', 'NOT_FOUND');

  if (payload.itemGroupId && String(payload.itemGroupId) !== String(existing.itemGroupId)) {
    await assertItemGroupBelongs({ organizationId, itemGroupId: payload.itemGroupId });
  }

  const next = {
    name: payload.name != null ? String(payload.name).trim() : existing.name,
    itemGroupId: payload.itemGroupId != null ? payload.itemGroupId : existing.itemGroupId,
    description: payload.description !== undefined ? (payload.description || null) : existing.description,
    status: payload.status != null
      ? (payload.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')
      : existing.status,
    effectiveFrom: payload.effectiveFrom !== undefined ? (payload.effectiveFrom || null) : existing.effectiveFrom,
    effectiveUntil: payload.effectiveUntil !== undefined ? (payload.effectiveUntil || null) : existing.effectiveUntil,
    assignedTo: payload.assignedTo !== undefined ? (payload.assignedTo || null) : existing.assignedTo,
    options: payload.options !== undefined ? normalizeOptions(payload.options) : existing.options,
    productRules: payload.productRules !== undefined ? normalizeProductRules(payload.productRules) : existing.productRules,
    compatibilityRules: payload.compatibilityRules !== undefined
      ? normalizeCompatibilityRules(payload.compatibilityRules)
      : existing.compatibilityRules,
    dependencyRules: payload.dependencyRules !== undefined
      ? normalizeDependencyRules(payload.dependencyRules)
      : existing.dependencyRules
  };

  if (!next.name) throw validationError('Configuration name is required');

  const changed = contentFingerprint(existing) !== contentFingerprint(next);
  if (changed) {
    const history = Array.isArray(existing.versionHistory) ? [...existing.versionHistory] : [];
    history.push({
      version: existing.version || 1,
      snapshot: configurationContentSnapshot(existing),
      changedBy: userId,
      changedAt: new Date(),
      changeNote: changeNote || null
    });
    // Cap history to last 50 versions
    existing.versionHistory = history.slice(-50);
    existing.version = (existing.version || 1) + 1;
  }

  Object.assign(existing, next);
  existing.modifiedBy = userId;

  try {
    await existing.save();
  } catch (err) {
    if (err?.code === 11000) throw validationError('A product configuration with this name already exists');
    throw err;
  }
  return existing.toObject ? existing.toObject() : existing;
}

async function setProductConfigurationStatus({ organizationId, id, userId, status }) {
  if (!['ACTIVE', 'INACTIVE'].includes(status)) throw validationError('Invalid status');
  return updateProductConfiguration({
    organizationId,
    id,
    userId,
    payload: { status },
    changeNote: `Status set to ${status}`
  });
}

async function deleteProductConfiguration({ organizationId, id }) {
  const result = await ProductConfiguration.deleteOne({ organizationId, _id: id });
  if (!result.deletedCount) throw validationError('Product configuration not found', 'NOT_FOUND');
  return { deleted: true, id };
}

/**
 * Load config and validate selections (for quote/SO and UI).
 * When status must be active: pass requireActive=true.
 */
async function validateProductConfigurationById({
  organizationId,
  id,
  selections = {},
  requireActive = true,
  asOf = new Date()
}) {
  const config = await getProductConfiguration({ organizationId, id });
  if (requireActive && config.status !== 'ACTIVE') {
    return {
      valid: false,
      errors: [{ code: 'INACTIVE', message: 'Product configuration is inactive' }],
      appliedDependencies: [],
      recommended: [],
      disabledOptions: [],
      selections,
      configuration: config
    };
  }
  if (requireActive && !isConfigEffective(config, asOf)) {
    return {
      valid: false,
      errors: [{ code: 'NOT_EFFECTIVE', message: 'Product configuration is outside its effective date range' }],
      appliedDependencies: [],
      recommended: [],
      disabledOptions: [],
      selections,
      configuration: config
    };
  }
  const result = validateConfiguration(config, selections);
  return { ...result, configuration: config };
}

/**
 * Build immutable line snapshot used by quotes / sales orders for historical accuracy.
 */
function buildConfigurationLineSnapshot(config, validationResult) {
  return {
    productConfigurationId: config._id,
    productConfigurationVersion: config.version || 1,
    name: config.name,
    itemGroupId: config.itemGroupId,
    selections: validationResult.selections || {},
    appliedDependencies: validationResult.appliedDependencies || [],
    validatedAt: new Date().toISOString()
  };
}

/** Simple pricing engine: base → rules → promotions */
function calculatePrice({ basePrice, quantity = 1, rules = [], promotions = [] }) {
  const { runPricingPipeline } = require('./pricingCalculation');
  const mappedRules = (rules || []).map((rule, i) => ({
    name: rule.name || `rule_${i}`,
    status: 'ACTIVE',
    ruleType: String(rule.type || 'QUANTITY').toUpperCase() === 'CONTRACT' ? 'CONTRACT' : 'QUANTITY',
    priority: i,
    conditions: {
      minQty: rule.minQty,
      customerIds: rule.customerIds || (rule.contractPrice != null ? ['*'] : []),
    },
    adjustment:
      rule.contractPrice != null
        ? { type: 'fixed_price', value: Number(rule.contractPrice) }
        : rule.discountPercent != null
          ? { type: 'percent', value: Number(rule.discountPercent) }
          : { type: 'amount', value: Number(rule.discountAmount) || 0 },
  }));
  // Contract-style shorthand without customerIds — treat as unconditional fixed when contractPrice set
  const pipelineRules = mappedRules.map((r) => {
    if (r.ruleType === 'CONTRACT' && (!r.conditions.customerIds || r.conditions.customerIds[0] === '*')) {
      return {
        ...r,
        ruleType: 'DATE',
        conditions: { ...r.conditions, customerIds: [] },
      };
    }
    return r;
  });
  const pipelinePromos = (promotions || []).map((promo, i) => ({
    name: promo.name || `promo_${i}`,
    status: 'ACTIVE',
    promoType: promo.type === 'amount' ? 'PRODUCT_DISCOUNT' : 'PRODUCT_DISCOUNT',
    priority: i,
    effectiveFrom: promo.effectiveFrom || null,
    effectiveUntil: promo.effectiveUntil || null,
    action: {
      type: promo.type === 'amount' ? 'amount' : 'percent',
      value: Number(promo.value) || 0,
    },
  }));
  const result = runPricingPipeline({
    baseUnitPrice: basePrice,
    quantity,
    rules: pipelineRules,
    promotions: pipelinePromos,
  });
  return { unitPrice: result.unitPrice, applied: result.applied };
}

module.exports = {
  ItemGroup,
  ProductConfiguration,
  createItemGroup,
  updateItemGroup,
  listItemGroups,
  getItemGroup,
  previewVariants,
  previewItemGroupVariants,
  generateVariants,
  validateConfiguration,
  listProductConfigurations,
  getProductConfiguration,
  createProductConfiguration,
  updateProductConfiguration,
  setProductConfigurationStatus,
  deleteProductConfiguration,
  validateProductConfigurationById,
  buildConfigurationLineSnapshot,
  isConfigEffective,
  normalizeOptions,
  normalizeProductRules,
  normalizeCompatibilityRules,
  normalizeDependencyRules,
  calculatePrice,
  cartesian,
  comboKey,
  comboKeyFromAttributeValues,
  buildGenerationStats,
  OPTION_TYPES,
  PRODUCT_RULE_TYPES,
  COMPAT_MODES,
  DEPENDENCY_ACTIONS
};
