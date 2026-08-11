const PricingRule = require('../models/PricingRule');
const {
  isPricingRuleType,
  isPricingAdjustmentType,
  PRICING_STATUSES,
  normalizeCustomerType,
} = require('../constants/pricingEngine');

function validationError(message, code = 'VALIDATION') {
  const err = new Error(message);
  err.code = code;
  return err;
}

function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw validationError('Invalid date');
  return d;
}

function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object') return {};
  return {
    variantIds: Array.isArray(scope.variantIds) ? scope.variantIds : [],
    itemIds: Array.isArray(scope.itemIds) ? scope.itemIds : [],
    itemGroupIds: Array.isArray(scope.itemGroupIds) ? scope.itemGroupIds : [],
  };
}

function normalizeConditions(conditions) {
  if (!conditions || typeof conditions !== 'object') return {};
  const customerTypes = Array.isArray(conditions.customerTypes)
    ? conditions.customerTypes.map(normalizeCustomerType).filter(Boolean)
    : [];
  const regionCodes = Array.isArray(conditions.regionCodes)
    ? conditions.regionCodes.map((r) => String(r || '').trim().toUpperCase()).filter(Boolean)
    : [];
  return {
    minQty: conditions.minQty != null && conditions.minQty !== '' ? Number(conditions.minQty) : null,
    maxQty: conditions.maxQty != null && conditions.maxQty !== '' ? Number(conditions.maxQty) : null,
    customerTypes,
    regionCodes,
    channel: conditions.channel ? String(conditions.channel).trim() : null,
    customerIds: Array.isArray(conditions.customerIds) ? conditions.customerIds : [],
  };
}

function normalizeAdjustment(adjustment) {
  if (!adjustment || typeof adjustment !== 'object') {
    throw validationError('adjustment is required');
  }
  const type = String(adjustment.type || '').toLowerCase();
  if (!isPricingAdjustmentType(type)) {
    throw validationError('adjustment.type must be percent, amount, or fixed_price');
  }
  const value = Number(adjustment.value);
  if (!Number.isFinite(value)) throw validationError('adjustment.value must be a number');
  if (type === 'percent' && (value < 0 || value > 100)) {
    throw validationError('percent adjustment must be between 0 and 100');
  }
  if ((type === 'amount' || type === 'fixed_price') && value < 0) {
    throw validationError('adjustment value must be non-negative');
  }
  return { type, value };
}

function validateRulePayload(payload, { isCreate }) {
  const name = String(payload.name || '').trim();
  if (isCreate && !name) throw validationError('Rule name is required');

  let ruleType = payload.ruleType;
  if (isCreate || ruleType !== undefined) {
    ruleType = String(ruleType || '').toUpperCase();
    if (!isPricingRuleType(ruleType)) throw validationError('Invalid ruleType');
  }

  let status = payload.status;
  if (status !== undefined) {
    status = String(status || '').toUpperCase();
    if (!PRICING_STATUSES.includes(status)) throw validationError('Invalid status');
  }

  return {
    name: name || undefined,
    description: payload.description !== undefined
      ? (payload.description ? String(payload.description).trim() : null)
      : undefined,
    status,
    ruleType,
    priority: payload.priority !== undefined ? Number(payload.priority) || 100 : undefined,
    effectiveFrom: payload.effectiveFrom !== undefined ? parseDate(payload.effectiveFrom) : undefined,
    effectiveUntil: payload.effectiveUntil !== undefined ? parseDate(payload.effectiveUntil) : undefined,
    scope: payload.scope !== undefined ? normalizeScope(payload.scope) : undefined,
    conditions: payload.conditions !== undefined ? normalizeConditions(payload.conditions) : undefined,
    adjustment: payload.adjustment !== undefined ? normalizeAdjustment(payload.adjustment) : undefined,
  };
}

async function listRules(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) query.status = 'ACTIVE';
  return PricingRule.find(query).sort({ priority: 1, name: 1 }).lean();
}

async function getRule(organizationId, id) {
  return PricingRule.findOne({ _id: id, organizationId }).lean();
}

async function createRule({ organizationId, userId, payload }) {
  const n = validateRulePayload(payload || {}, { isCreate: true });
  return PricingRule.create({
    organizationId,
    name: n.name,
    description: n.description ?? null,
    status: n.status || 'ACTIVE',
    ruleType: n.ruleType,
    priority: n.priority ?? 100,
    effectiveFrom: n.effectiveFrom ?? null,
    effectiveUntil: n.effectiveUntil ?? null,
    scope: n.scope || {},
    conditions: n.conditions || {},
    adjustment: n.adjustment,
    createdBy: userId,
    modifiedBy: userId,
  });
}

async function updateRule({ organizationId, id, userId, payload }) {
  const rule = await PricingRule.findOne({ _id: id, organizationId });
  if (!rule) return null;
  const n = validateRulePayload(payload || {}, { isCreate: false });
  if (n.name !== undefined) rule.name = n.name;
  if (n.description !== undefined) rule.description = n.description;
  if (n.status !== undefined) rule.status = n.status;
  if (n.ruleType !== undefined) rule.ruleType = n.ruleType;
  if (n.priority !== undefined) rule.priority = n.priority;
  if (n.effectiveFrom !== undefined) rule.effectiveFrom = n.effectiveFrom;
  if (n.effectiveUntil !== undefined) rule.effectiveUntil = n.effectiveUntil;
  if (n.scope !== undefined) rule.scope = n.scope;
  if (n.conditions !== undefined) rule.conditions = n.conditions;
  if (n.adjustment !== undefined) rule.adjustment = n.adjustment;
  rule.modifiedBy = userId;
  await rule.save();
  return rule;
}

async function deleteRule({ organizationId, id }) {
  return PricingRule.findOneAndDelete({ _id: id, organizationId });
}

module.exports = {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
};
