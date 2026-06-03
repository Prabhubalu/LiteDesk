/**
 * INV3 — ATP guards for quote/SO line-add and portal quote accept.
 * Locked formula: ATP = onHand - reserved (read-only).
 */

const QuoteLine = require('../models/QuoteLine');
const SalesOrderLine = require('../models/SalesOrderLine');
const { roundQty } = require('../constants/inventoryLifecycle');
const { getAtpForVariant } = require('./inventoryAtpService');
const { getDefaultLocation } = require('./inventoryLocationService');
const { getAtpGuardPolicies } = require('./inventorySettingsService');
const {
  shouldTrackInventoryForLine,
  shouldTrackInventoryForQuoteLine
} = require('./inventoryLineEligibilityService');

function aggregateVariantQuantities(checks) {
  const byVariant = new Map();
  for (const row of checks || []) {
    if (!row?.variantId) continue;
    const key = String(row.variantId);
    const qty = roundQty(row.quantity);
    if (qty <= 0) continue;
    const existing = byVariant.get(key) || { variantId: row.variantId, quantity: 0 };
    existing.quantity = roundQty(existing.quantity + qty);
    byVariant.set(key, existing);
  }
  return [...byVariant.values()];
}

function buildQuoteLineChecks(lines) {
  return aggregateVariantQuantities(
    (lines || [])
      .filter((line) => shouldTrackInventoryForQuoteLine(line))
      .map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
  );
}

function buildSalesOrderLineChecks(order, lines) {
  return aggregateVariantQuantities(
    (lines || [])
      .filter((line) => shouldTrackInventoryForLine(order, line))
      .map((line) => ({ variantId: line.variantId, quantity: line.quantity }))
  );
}

async function runAtpChecks({
  organizationId,
  policy,
  checks,
  userId = null,
  forceProceed = false
}) {
  const resolvedPolicy = String(policy || 'off').toLowerCase();
  if (resolvedPolicy === 'off' || !checks.length) {
    return { policy: resolvedPolicy, sufficient: true, results: [], warnings: [] };
  }

  const location = await getDefaultLocation(organizationId, userId);
  const inventoryLocationId = location.inventoryLocationId;
  const results = [];
  const warnings = [];

  for (const check of checks) {
    const atp = await getAtpForVariant({
      organizationId,
      variantId: check.variantId,
      inventoryLocationId,
      quantity: check.quantity
    });
    results.push(atp);
    if (!atp.sufficient) {
      warnings.push({
        variantId: String(check.variantId),
        quantity: roundQty(check.quantity),
        onHand: atp.onHand,
        reserved: atp.reserved,
        available: atp.available,
        inventoryLocationId
      });
    }
  }

  if (!warnings.length) {
    return { policy: resolvedPolicy, sufficient: true, results, warnings: [] };
  }

  if (resolvedPolicy === 'warn') {
    if (forceProceed) {
      return {
        policy: resolvedPolicy,
        sufficient: false,
        results,
        warnings,
        proceededDespiteWarning: true
      };
    }
    const err = new Error('Insufficient ATP for requested quantity');
    err.code = 'INSUFFICIENT_ATP';
    err.policy = 'warn';
    err.canProceed = true;
    err.details = { policy: resolvedPolicy, warnings, results };
    throw err;
  }

  const err = new Error('Insufficient ATP for requested quantity');
  err.code = 'INSUFFICIENT_ATP';
  err.policy = 'block';
  err.canProceed = false;
  err.details = { policy: resolvedPolicy, warnings, results };
  throw err;
}

async function guardQuoteLineQuantity({
  organizationId,
  quoteId,
  variantId,
  quantity,
  userId = null,
  forceProceed = false,
  policy = null,
  excludeQuoteLineId = null
}) {
  const policies = policy ? { lineAdd: policy } : await getAtpGuardPolicies(organizationId);
  const existingLines = await QuoteLine.find({ organizationId, quoteId, hiddenLine: { $ne: true } }).lean();
  const existingQty = existingLines
    .filter(
      (line) =>
        shouldTrackInventoryForQuoteLine(line) &&
        String(line.variantId) === String(variantId) &&
        String(line.quoteLineId) !== String(excludeQuoteLineId || '')
    )
    .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  return runAtpChecks({
    organizationId,
    policy: policies.lineAdd,
    userId,
    forceProceed,
    checks: [{ variantId, quantity: roundQty(existingQty + quantity) }]
  });
}

async function guardSalesOrderLineQuantity({
  organizationId,
  order,
  variantId,
  quantity,
  userId = null,
  forceProceed = false,
  policy = null,
  excludeSalesOrderLineId = null
}) {
  const policies = policy ? { lineAdd: policy } : await getAtpGuardPolicies(organizationId);
  if (String(order?.fulfillmentMode || 'hybrid').toLowerCase() === 'service') {
    return { policy: policies.lineAdd, sufficient: true, results: [], warnings: [] };
  }

  const existingLines = await SalesOrderLine.find({
    organizationId,
    salesOrderId: order._id,
    hiddenLine: { $ne: true }
  }).lean();

  const existingQty = existingLines
    .filter(
      (line) =>
        shouldTrackInventoryForLine(order, line) &&
        String(line.variantId) === String(variantId) &&
        String(line.salesOrderLineId) !== String(excludeSalesOrderLineId || '')
    )
    .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  return runAtpChecks({
    organizationId,
    policy: policies.lineAdd,
    userId,
    forceProceed,
    checks: [{ variantId, quantity: roundQty(existingQty + quantity) }]
  });
}

async function guardQuoteLineCollection({
  organizationId,
  lines,
  userId = null,
  forceProceed = false,
  policy = null
}) {
  const policies = policy ? { lineAdd: policy } : await getAtpGuardPolicies(organizationId);
  return runAtpChecks({
    organizationId,
    policy: policies.lineAdd,
    userId,
    forceProceed,
    checks: buildQuoteLineChecks(lines)
  });
}

async function guardQuoteAcceptance({
  organizationId,
  acceptedLines,
  userId = null,
  policy = null
}) {
  const policies = policy ? { quoteAccept: policy } : await getAtpGuardPolicies(organizationId);
  const resolvedPolicy = policies.quoteAccept;

  try {
    return await runAtpChecks({
      organizationId,
      policy: resolvedPolicy,
      userId,
      forceProceed: resolvedPolicy === 'warn',
      checks: buildQuoteLineChecks(acceptedLines)
    });
  } catch (err) {
    if (err?.code === 'INSUFFICIENT_ATP' && resolvedPolicy === 'warn') {
      return {
        policy: resolvedPolicy,
        sufficient: false,
        warnings: err.details?.warnings || [],
        results: err.details?.results || [],
        acceptanceWarning: true
      };
    }
    throw err;
  }
}

module.exports = {
  aggregateVariantQuantities,
  buildQuoteLineChecks,
  buildSalesOrderLineChecks,
  runAtpChecks,
  guardQuoteLineQuantity,
  guardSalesOrderLineQuantity,
  guardQuoteLineCollection,
  guardQuoteAcceptance
};
