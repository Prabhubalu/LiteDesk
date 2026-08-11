/**
 * Pure pricing calculation — no I/O.
 * Used by pricingEngineService and unit tests.
 */

const {
  normalizeCustomerType,
  roundMoney,
  isPricingAdjustmentType,
} = require('../constants/pricingEngine');

function isWithinDates(from, until, asOf) {
  const t = asOf instanceof Date ? asOf.getTime() : new Date(asOf).getTime();
  if (Number.isNaN(t)) return false;
  if (from) {
    const f = new Date(from).getTime();
    if (!Number.isNaN(f) && t < f) return false;
  }
  if (until) {
    const u = new Date(until).getTime();
    if (!Number.isNaN(u) && t > u) return false;
  }
  return true;
}

function catalogApplies(scope, ctx) {
  if (!scope || typeof scope !== 'object') return true;
  const variantId = ctx.variantId ? String(ctx.variantId) : null;
  const itemId = ctx.itemId ? String(ctx.itemId) : null;
  const itemGroupId = ctx.itemGroupId ? String(ctx.itemGroupId) : null;

  if (Array.isArray(scope.variantIds) && scope.variantIds.length) {
    if (!variantId || !scope.variantIds.map(String).includes(variantId)) return false;
  }
  if (Array.isArray(scope.itemIds) && scope.itemIds.length) {
    if (!itemId || !scope.itemIds.map(String).includes(itemId)) return false;
  }
  if (Array.isArray(scope.itemGroupIds) && scope.itemGroupIds.length) {
    if (!itemGroupId || !scope.itemGroupIds.map(String).includes(itemGroupId)) return false;
  }
  return true;
}

function matchesCustomerTypes(list, customerType) {
  if (!Array.isArray(list) || !list.length) return true;
  const ct = normalizeCustomerType(customerType);
  if (!ct) return false;
  return list.map((x) => String(x).toUpperCase()).includes(ct);
}

function matchesRegion(list, regionCode) {
  if (!Array.isArray(list) || !list.length) return true;
  if (!regionCode) return false;
  const r = String(regionCode).trim().toUpperCase();
  return list.map((x) => String(x).trim().toUpperCase()).includes(r);
}

function matchesChannel(expected, channel) {
  if (!expected) return true;
  if (!channel) return false;
  return String(expected).trim().toUpperCase() === String(channel).trim().toUpperCase();
}

function matchesCustomerIds(list, customerId) {
  if (!Array.isArray(list) || !list.length) return true;
  if (!customerId) return false;
  return list.map(String).includes(String(customerId));
}

/**
 * Apply adjustment to a running unit price.
 * @returns {{ unitPrice: number, delta: number, mode: string }}
 */
function applyAdjustment(unitPrice, adjustment) {
  const price = Number(unitPrice) || 0;
  const type = String(adjustment?.type || '').toLowerCase();
  const value = Number(adjustment?.value);
  if (!isPricingAdjustmentType(type) || !Number.isFinite(value)) {
    return { unitPrice: price, delta: 0, mode: 'none' };
  }
  if (type === 'fixed_price') {
    const next = Math.max(0, value);
    return { unitPrice: roundMoney(next), delta: roundMoney(next - price), mode: 'fixed_price' };
  }
  if (type === 'percent') {
    const delta = -roundMoney((price * value) / 100);
    return { unitPrice: roundMoney(Math.max(0, price + delta)), delta, mode: 'percent' };
  }
  // amount off
  const delta = -Math.min(price, Math.max(0, value));
  return { unitPrice: roundMoney(Math.max(0, price + delta)), delta: roundMoney(delta), mode: 'amount' };
}

/**
 * Buy X get Y — paid units for a purchase quantity.
 * e.g. buy 2 get 1 free → qty 3 pays 2; qty 5 pays 4.
 */
function buyXGetYPaidUnits(quantity, buyQty, getQty) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const buy = Math.max(1, Math.floor(Number(buyQty) || 1));
  const get = Math.max(0, Math.floor(Number(getQty) || 0));
  if (get === 0) return qty;
  const pack = buy + get;
  const packs = Math.floor(qty / pack);
  const rem = qty % pack;
  return packs * buy + Math.min(rem, buy);
}

function ruleMatches(rule, ctx) {
  if (!rule || String(rule.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;
  if (!isWithinDates(rule.effectiveFrom, rule.effectiveUntil, ctx.asOf)) return false;
  if (!catalogApplies(rule.scope, ctx)) return false;

  const cond = rule.conditions || {};
  const qty = Number(ctx.quantity) || 1;
  const type = String(rule.ruleType || '').toUpperCase();

  if (cond.minQty != null && qty < Number(cond.minQty)) return false;
  if (cond.maxQty != null && qty > Number(cond.maxQty)) return false;
  if (!matchesCustomerTypes(cond.customerTypes, ctx.customerType)) return false;
  if (!matchesRegion(cond.regionCodes, ctx.regionCode)) return false;
  if (!matchesChannel(cond.channel, ctx.channel)) return false;
  if (!matchesCustomerIds(cond.customerIds, ctx.customerId)) return false;

  // Type gates — require type-specific context when the rule is specialized
  if (type === 'QUANTITY') {
    if (cond.minQty == null && cond.maxQty == null) return false;
  }
  if (type === 'CUSTOMER' && !(Array.isArray(cond.customerTypes) && cond.customerTypes.length)) {
    return false;
  }
  if (type === 'REGION' && !(Array.isArray(cond.regionCodes) && cond.regionCodes.length)) {
    return false;
  }
  if (type === 'CHANNEL' && !cond.channel) return false;
  if (type === 'CONTRACT' && !(Array.isArray(cond.customerIds) && cond.customerIds.length)) {
    return false;
  }
  if (type === 'DATE') {
    // date-only rules rely on effectiveFrom/Until only
  }

  return true;
}

function promotionMatches(promo, ctx) {
  if (!promo || String(promo.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') return false;
  if (!isWithinDates(promo.effectiveFrom, promo.effectiveUntil, ctx.asOf)) return false;
  if (!catalogApplies(promo.scope, ctx)) return false;

  const cond = promo.conditions || {};
  const qty = Number(ctx.quantity) || 1;
  const type = String(promo.promoType || '').toUpperCase();

  if (cond.minQty != null && qty < Number(cond.minQty)) return false;
  if (cond.maxQty != null && qty > Number(cond.maxQty)) return false;
  if (!matchesCustomerTypes(cond.customerTypes, ctx.customerType)) return false;
  if (!matchesRegion(cond.regionCodes, ctx.regionCode)) return false;
  if (!matchesChannel(cond.channel, ctx.channel)) return false;
  if (!matchesCustomerIds(cond.customerIds, ctx.customerId)) return false;

  if (type === 'ORDER_DISCOUNT') {
    const minOrder = Number(cond.minOrderSubtotal);
    if (Number.isFinite(minOrder) && minOrder > 0) {
      const sub = Number(ctx.orderSubtotal);
      if (!Number.isFinite(sub) || sub < minOrder) return false;
    }
  }

  if (type === 'BUY_X_GET_Y') {
    const buy = Number(promo.action?.buyQty) || 0;
    const get = Number(promo.action?.getQty) || 0;
    if (buy < 1 || get < 1) return false;
    if (qty < buy + get && qty < buy) return false;
  }

  if (type === 'SHIPPING_DISCOUNT') {
    // Line engine records eligibility; shipping total is external
    return true;
  }

  return true;
}

function applyPromotion(unitPrice, quantity, promo) {
  const type = String(promo.promoType || '').toUpperCase();
  const action = promo.action || {};
  const price = Number(unitPrice) || 0;
  const qty = Math.max(1, Number(quantity) || 1);

  if (type === 'BUY_X_GET_Y') {
    const buy = Math.max(1, Number(action.buyQty) || 1);
    const get = Math.max(0, Number(action.getQty) || 0);
    const paid = buyXGetYPaidUnits(qty, buy, get);
    if (paid >= qty) {
      return { unitPrice: price, delta: 0, mode: 'buy_x_get_y', paidUnits: paid };
    }
    const next = roundMoney((price * paid) / qty);
    return {
      unitPrice: next,
      delta: roundMoney(next - price),
      mode: 'buy_x_get_y',
      paidUnits: paid,
      freeUnits: qty - paid,
    };
  }

  if (type === 'SHIPPING_DISCOUNT') {
    return { unitPrice: price, delta: 0, mode: 'shipping', deferred: true };
  }

  // PRODUCT / ORDER / VOLUME / CUSTOMER / FESTIVAL — percent or amount
  const adjType = action.type === 'amount' ? 'amount' : 'percent';
  const result = applyAdjustment(price, { type: adjType, value: action.value });
  return { ...result, mode: type.toLowerCase() };
}

/**
 * @param {{ baseUnitPrice: number, quantity: number, asOf: Date, context: object, rules: object[], promotions: object[] }} input
 */
function runPricingPipeline({ baseUnitPrice, quantity = 1, asOf = new Date(), context = {}, rules = [], promotions = [] }) {
  const ctx = {
    quantity: Math.max(1, Number(quantity) || 1),
    asOf: asOf instanceof Date ? asOf : new Date(asOf),
    variantId: context.variantId || null,
    itemId: context.itemId || null,
    itemGroupId: context.itemGroupId || null,
    customerType: context.customerType || null,
    regionCode: context.regionCode || null,
    channel: context.channel || null,
    customerId: context.customerId || null,
    currency: context.currency || null,
    orderSubtotal: context.orderSubtotal,
  };

  let unitPrice = roundMoney(baseUnitPrice);
  const listPrice = unitPrice;
  const applied = [];
  const rejections = [];

  const sortedRules = [...rules].sort((a, b) => {
    const p = (Number(a.priority) || 100) - (Number(b.priority) || 100);
    if (p !== 0) return p;
    return String(a._id || a.name || '').localeCompare(String(b._id || b.name || ''));
  });

  for (const rule of sortedRules) {
    if (!ruleMatches(rule, ctx)) {
      if (rule && String(rule.status || '').toUpperCase() === 'ACTIVE') {
        rejections.push({
          kind: 'rule',
          id: rule._id ? String(rule._id) : null,
          name: rule.name || null,
          reason: 'conditions_not_met',
        });
      }
      continue;
    }
    const before = unitPrice;
    const result = applyAdjustment(unitPrice, rule.adjustment);
    unitPrice = result.unitPrice;
    applied.push({
      kind: 'rule',
      id: rule._id ? String(rule._id) : null,
      name: rule.name || null,
      ruleType: rule.ruleType,
      mode: result.mode,
      delta: result.delta,
      unitPriceBefore: before,
      unitPriceAfter: unitPrice,
    });
  }

  const sortedPromos = [...promotions].sort((a, b) => {
    const p = (Number(a.priority) || 100) - (Number(b.priority) || 100);
    if (p !== 0) return p;
    return String(a._id || a.name || '').localeCompare(String(b._id || b.name || ''));
  });

  for (const promo of sortedPromos) {
    if (!promotionMatches(promo, ctx)) {
      if (promo && String(promo.status || '').toUpperCase() === 'ACTIVE') {
        rejections.push({
          kind: 'promotion',
          id: promo._id ? String(promo._id) : null,
          name: promo.name || null,
          reason: 'conditions_not_met',
        });
      }
      continue;
    }
    const before = unitPrice;
    const result = applyPromotion(unitPrice, ctx.quantity, promo);
    unitPrice = result.unitPrice;
    applied.push({
      kind: 'promotion',
      id: promo._id ? String(promo._id) : null,
      name: promo.name || null,
      promoType: promo.promoType,
      mode: result.mode,
      delta: result.delta,
      unitPriceBefore: before,
      unitPriceAfter: unitPrice,
      paidUnits: result.paidUnits,
      freeUnits: result.freeUnits,
      deferred: result.deferred || false,
    });
  }

  const totalDiscountPerUnit = roundMoney(listPrice - unitPrice);

  return {
    listPrice,
    unitPrice,
    quantity: ctx.quantity,
    totalDiscountPerUnit,
    lineDiscount: roundMoney(totalDiscountPerUnit * ctx.quantity),
    applied,
    rejections,
  };
}

/**
 * Score a price book for automatic selection (higher = better).
 * Explicit priceBookId bypasses scoring.
 */
function scorePriceBook(book, ctx) {
  if (!book || book.isActive === false) return -1;
  if (!isWithinDates(book.effectiveFrom, book.effectiveUntil, ctx.asOf || new Date())) return -1;

  let score = 0;
  const types = Array.isArray(book.customerTypes) ? book.customerTypes : [];
  const regions = Array.isArray(book.regionCodes) ? book.regionCodes : [];

  if (types.length) {
    if (!matchesCustomerTypes(types, ctx.customerType)) return -1;
    score += 40;
  }
  if (regions.length) {
    if (!matchesRegion(regions, ctx.regionCode)) return -1;
    score += 30;
  }
  if (book.currency && ctx.currency) {
    if (String(book.currency).toUpperCase() === String(ctx.currency).toUpperCase()) score += 10;
    else score -= 5;
  }
  if (book.isDefault) score += 1;
  score += Math.max(0, 20 - Math.min(20, Number(book.priority) || 100) / 5);
  return score;
}

function selectBestPriceBook(books, ctx) {
  let best = null;
  let bestScore = -1;
  for (const book of books || []) {
    const s = scorePriceBook(book, ctx);
    if (s > bestScore) {
      bestScore = s;
      best = book;
    }
  }
  return bestScore >= 0 ? best : null;
}

module.exports = {
  isWithinDates,
  catalogApplies,
  applyAdjustment,
  buyXGetYPaidUnits,
  ruleMatches,
  promotionMatches,
  applyPromotion,
  runPricingPipeline,
  scorePriceBook,
  selectBestPriceBook,
};
