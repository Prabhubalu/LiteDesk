/**
 * INV1 — Determine which SO lines participate in inventory + bundle explosion.
 */

const SalesOrderLine = require('../models/SalesOrderLine');
const { roundQty } = require('../constants/inventoryLifecycle');

function shouldTrackInventoryForLine(order, line) {
  if (!line || line.hiddenLine === true) return false;

  const mode = String(order?.fulfillmentMode || 'hybrid').toLowerCase();
  if (mode === 'service') return false;

  const lineType = String(line.lineType || 'standard');
  if (lineType === 'bundle_parent') return false;

  return Boolean(line.variantId);
}

function shouldTrackInventoryForQuoteLine(line) {
  if (!line || line.hiddenLine === true) return false;
  if (String(line.lineType || 'standard') === 'bundle_parent') return false;
  return Boolean(line.variantId);
}

function getOpenLineQuantity(line) {
  const qty = Number(line?.quantity) || 0;
  const fulfilled = Number(line?.quantityFulfilled) || 0;
  const cancelled = Number(line?.quantityCancelled) || 0;
  return Math.max(0, roundQty(qty - fulfilled - cancelled));
}

async function listInventoryEligibleLines({ organizationId, salesOrderId, order, lines = null }) {
  const rows =
    lines ||
    (await SalesOrderLine.find({
      organizationId,
      salesOrderId,
      hiddenLine: { $ne: true }
    }).lean());

  return rows.filter((line) => shouldTrackInventoryForLine(order, line));
}

/**
 * Expand a fulfillment delta into component-level inventory deductions.
 */
async function resolveInventoryDeductionLines({
  organizationId,
  salesOrderId,
  order,
  salesOrderLineId,
  quantityDelta,
  allLines = null
}) {
  const delta = roundQty(quantityDelta);
  if (delta <= 0) return [];

  const lines =
    allLines ||
    (await SalesOrderLine.find({
      organizationId,
      salesOrderId,
      hiddenLine: { $ne: true }
    }));

  const lineById = new Map(lines.map((row) => [String(row.salesOrderLineId), row]));
  const line = lineById.get(String(salesOrderLineId));
  if (!line || !shouldTrackInventoryForLine(order, line)) return [];

  const lineType = String(line.lineType || 'standard');
  if (lineType === 'bundle_parent') {
    const parentQty = Number(line.quantity) || 1;
    const components = lines.filter(
      (row) => String(row.parentBundleLineId || '') === String(line._id)
    );

    return components
      .filter((component) => shouldTrackInventoryForLine(order, component))
      .map((component) => ({
        salesOrderLineId: String(component.salesOrderLineId),
        variantId: component.variantId,
        quantityDelta: roundQty((Number(component.quantity) / parentQty) * delta)
      }))
      .filter((row) => row.quantityDelta > 0);
  }

  return [
    {
      salesOrderLineId: String(line.salesOrderLineId),
      variantId: line.variantId,
      quantityDelta: delta
    }
  ];
}

module.exports = {
  shouldTrackInventoryForLine,
  shouldTrackInventoryForQuoteLine,
  getOpenLineQuantity,
  listInventoryEligibleLines,
  resolveInventoryDeductionLines
};
