const PricingPromotion = require('../models/PricingPromotion');
const {
  isPricingPromoType,
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
    minOrderSubtotal:
      conditions.minOrderSubtotal != null && conditions.minOrderSubtotal !== ''
        ? Number(conditions.minOrderSubtotal)
        : null,
    customerTypes,
    regionCodes,
    channel: conditions.channel ? String(conditions.channel).trim() : null,
    customerIds: Array.isArray(conditions.customerIds) ? conditions.customerIds : [],
  };
}

function normalizeAction(action, promoType) {
  if (!action || typeof action !== 'object') throw validationError('action is required');
  const type = action.type === 'amount' ? 'amount' : 'percent';
  const value = Number(action.value) || 0;
  const buyQty = action.buyQty != null ? Number(action.buyQty) : null;
  const getQty = action.getQty != null ? Number(action.getQty) : null;

  if (promoType === 'BUY_X_GET_Y') {
    if (!buyQty || buyQty < 1 || !getQty || getQty < 1) {
      throw validationError('BUY_X_GET_Y requires buyQty >= 1 and getQty >= 1');
    }
  } else if (promoType !== 'SHIPPING_DISCOUNT') {
    if (type === 'percent' && (value < 0 || value > 100)) {
      throw validationError('percent must be between 0 and 100');
    }
    if (type === 'amount' && value < 0) throw validationError('amount must be non-negative');
  }

  return {
    type,
    value,
    buyQty,
    getQty,
    getVariantId: action.getVariantId || null,
  };
}

function validatePromoPayload(payload, { isCreate }) {
  const name = String(payload.name || '').trim();
  if (isCreate && !name) throw validationError('Promotion name is required');

  let promoType = payload.promoType;
  if (isCreate || promoType !== undefined) {
    promoType = String(promoType || '').toUpperCase();
    if (!isPricingPromoType(promoType)) throw validationError('Invalid promoType');
  }

  let status = payload.status;
  if (status !== undefined) {
    status = String(status || '').toUpperCase();
    if (!PRICING_STATUSES.includes(status)) throw validationError('Invalid status');
  }

  const action =
    payload.action !== undefined
      ? normalizeAction(payload.action, promoType || payload.promoType)
      : undefined;

  return {
    name: name || undefined,
    description: payload.description !== undefined
      ? (payload.description ? String(payload.description).trim() : null)
      : undefined,
    status,
    promoType,
    priority: payload.priority !== undefined ? Number(payload.priority) || 100 : undefined,
    effectiveFrom: payload.effectiveFrom !== undefined ? parseDate(payload.effectiveFrom) : undefined,
    effectiveUntil: payload.effectiveUntil !== undefined ? parseDate(payload.effectiveUntil) : undefined,
    scope: payload.scope !== undefined ? normalizeScope(payload.scope) : undefined,
    conditions: payload.conditions !== undefined ? normalizeConditions(payload.conditions) : undefined,
    action,
  };
}

async function listPromotions(organizationId, { includeInactive = false } = {}) {
  const query = { organizationId };
  if (!includeInactive) query.status = 'ACTIVE';
  return PricingPromotion.find(query).sort({ priority: 1, name: 1 }).lean();
}

async function getPromotion(organizationId, id) {
  return PricingPromotion.findOne({ _id: id, organizationId }).lean();
}

async function createPromotion({ organizationId, userId, payload }) {
  const n = validatePromoPayload(payload || {}, { isCreate: true });
  return PricingPromotion.create({
    organizationId,
    name: n.name,
    description: n.description ?? null,
    status: n.status || 'ACTIVE',
    promoType: n.promoType,
    priority: n.priority ?? 100,
    effectiveFrom: n.effectiveFrom ?? null,
    effectiveUntil: n.effectiveUntil ?? null,
    scope: n.scope || {},
    conditions: n.conditions || {},
    action: n.action,
    createdBy: userId,
    modifiedBy: userId,
  });
}

async function updatePromotion({ organizationId, id, userId, payload }) {
  const promo = await PricingPromotion.findOne({ _id: id, organizationId });
  if (!promo) return null;
  const n = validatePromoPayload(
    { ...payload, promoType: payload.promoType || promo.promoType },
    { isCreate: false }
  );
  if (n.name !== undefined) promo.name = n.name;
  if (n.description !== undefined) promo.description = n.description;
  if (n.status !== undefined) promo.status = n.status;
  if (n.promoType !== undefined) promo.promoType = n.promoType;
  if (n.priority !== undefined) promo.priority = n.priority;
  if (n.effectiveFrom !== undefined) promo.effectiveFrom = n.effectiveFrom;
  if (n.effectiveUntil !== undefined) promo.effectiveUntil = n.effectiveUntil;
  if (n.scope !== undefined) promo.scope = n.scope;
  if (n.conditions !== undefined) promo.conditions = n.conditions;
  if (n.action !== undefined) promo.action = n.action;
  promo.modifiedBy = userId;
  await promo.save();
  return promo;
}

async function deletePromotion({ organizationId, id }) {
  return PricingPromotion.findOneAndDelete({ _id: id, organizationId });
}

module.exports = {
  listPromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
