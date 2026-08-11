const pricingRuleService = require('../services/pricingRuleService');
const pricingPromotionService = require('../services/pricingPromotionService');
const { resolveCommercialPrice } = require('../services/pricingEngineService');
const {
  PRICING_CUSTOMER_TYPES,
  PRICING_RULE_TYPES,
  PRICING_PROMO_TYPES,
  PRICING_ADJUSTMENT_TYPES,
  PRICING_STATUSES,
} = require('../constants/pricingEngine');

function sendServiceError(res, err, logLabel) {
  if (err.code === 'NOT_FOUND') {
    return res.status(404).json({ success: false, message: err.message, code: err.code });
  }
  if (err.code === 'VALIDATION' || err.code === 'DUPLICATE') {
    return res.status(400).json({ success: false, message: err.message, code: err.code });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, message: 'A record with this name already exists', code: 'DUPLICATE' });
  }
  console.error(logLabel, err);
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
}

exports.getPricingMeta = async (_req, res) => {
  res.json({
    success: true,
    data: {
      customerTypes: PRICING_CUSTOMER_TYPES,
      ruleTypes: PRICING_RULE_TYPES,
      promoTypes: PRICING_PROMO_TYPES,
      adjustmentTypes: PRICING_ADJUSTMENT_TYPES,
      statuses: PRICING_STATUSES,
      calculationOrder: ['base_price_list', 'pricing_rules', 'promotions', 'taxes_and_charges'],
      promotionStackingPolicy: 'all_eligible_by_priority',
    },
  });
};

exports.listRules = async (req, res) => {
  try {
    const data = await pricingRuleService.listRules(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true',
    });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'listRules');
  }
};

exports.createRule = async (req, res) => {
  try {
    const data = await pricingRuleService.createRule({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {},
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'createRule');
  }
};

exports.updateRule = async (req, res) => {
  try {
    const data = await pricingRuleService.updateRule({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {},
    });
    if (!data) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'updateRule');
  }
};

exports.deleteRule = async (req, res) => {
  try {
    const removed = await pricingRuleService.deleteRule({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    sendServiceError(res, err, 'deleteRule');
  }
};

exports.listPromotions = async (req, res) => {
  try {
    const data = await pricingPromotionService.listPromotions(req.user.organizationId, {
      includeInactive: req.query.includeInactive === 'true',
    });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'listPromotions');
  }
};

exports.createPromotion = async (req, res) => {
  try {
    const data = await pricingPromotionService.createPromotion({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      payload: req.body || {},
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'createPromotion');
  }
};

exports.updatePromotion = async (req, res) => {
  try {
    const data = await pricingPromotionService.updatePromotion({
      organizationId: req.user.organizationId,
      id: req.params.id,
      userId: req.user._id,
      payload: req.body || {},
    });
    if (!data) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'updatePromotion');
  }
};

exports.deletePromotion = async (req, res) => {
  try {
    const removed = await pricingPromotionService.deletePromotion({
      organizationId: req.user.organizationId,
      id: req.params.id,
    });
    if (!removed) return res.status(404).json({ success: false, message: 'Promotion not found' });
    res.json({ success: true, message: 'Promotion deleted' });
  } catch (err) {
    sendServiceError(res, err, 'deletePromotion');
  }
};

/**
 * Preview commercial unit price: base → rules → promotions.
 * Body: { variantId, quantity?, priceBookId?, asOfDate?, context? }
 */
exports.resolvePrice = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.variantId) {
      return res.status(400).json({ success: false, message: 'variantId is required' });
    }
    const data = await resolveCommercialPrice({
      organizationId: req.user.organizationId,
      variantId: body.variantId,
      priceBookId: body.priceBookId || null,
      quantity: body.quantity ?? 1,
      asOfDate: body.asOfDate || null,
      context: body.context || {},
      applyRulesAndPromotions: body.applyRulesAndPromotions !== false,
    });
    res.json({ success: true, data });
  } catch (err) {
    sendServiceError(res, err, 'resolvePrice');
  }
};
