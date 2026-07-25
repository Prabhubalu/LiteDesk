'use strict';

const { formatTallyDate } = require('./salesVoucherMapper');

/**
 * Inventory transfer / adjustment → Tally Stock Journal
 */

/**
 * @param {object} input
 * @param {object} [input.transaction] - InventoryTransaction-like header
 * @param {object[]} [input.lines] - legs with variant/qty/from/to
 * @param {string} [input.transactionType] - transfer | adjustment | stock_journal
 */
function toTally(input = {}) {
  const transaction = input.transaction || {};
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const transactionType = String(
    input.transactionType || transaction.transactionType || 'stock_journal'
  ).toLowerCase();

  const voucherNumber =
    transaction.inventoryTransactionId ||
    transaction.transactionNumber ||
    transaction.reference ||
    null;

  const sourceEntries = [];
  const destinationEntries = [];

  for (const line of lines) {
    const qty = Math.abs(Number(line.quantity ?? line.quantityDelta ?? 0) || 0);
    if (qty <= 0) continue;

    const rawName = line.stockItemName || line.itemNameSnapshot || line.skuSnapshot || line.variantId;
    const stockItemName = rawName != null && rawName !== '' ? String(rawName) : null;

    const entry = {
      stockItemName,
      quantity: qty,
      rate: line.rate != null ? Number(line.rate) : null,
      amount: line.amount != null ? Number(line.amount) : null,
      batchName: line.batchName || line.lotNumber || null,
      godownName: null,
      arivuLineId: line.lineId || (line._id ? String(line._id) : null),
      variantId: line.variantId ? String(line.variantId) : null,
    };

    const delta = Number(line.quantityDelta);
    const fromGodown = line.fromGodownName || line.fromLocationName || null;
    const toGodown = line.toGodownName || line.toLocationName || null;

    if (transactionType === 'transfer' || (fromGodown && toGodown)) {
      sourceEntries.push({
        ...entry,
        godownName: fromGodown || line.godownName || null,
      });
      destinationEntries.push({
        ...entry,
        godownName: toGodown || null,
      });
    } else if (Number.isFinite(delta) && delta < 0) {
      sourceEntries.push({
        ...entry,
        godownName: line.godownName || line.locationName || fromGodown || null,
      });
    } else {
      destinationEntries.push({
        ...entry,
        godownName: line.godownName || line.locationName || toGodown || null,
      });
    }
  }

  return {
    voucherType: 'Stock Journal',
    date: formatTallyDate(transaction.postedAt || transaction.transactionDate || new Date()),
    voucherNumber,
    reference: voucherNumber,
    narration: transaction.notes || input.notes || null,
    transactionType,
    fromLocationId: input.fromLocationId || transaction.fromLocationId || null,
    toLocationId: input.toLocationId || transaction.toLocationId || null,
    sourceEntries,
    destinationEntries,
    arivuId: transaction._id
      ? String(transaction._id)
      : transaction.inventoryTransactionId
        ? String(transaction.inventoryTransactionId)
        : null,
  };
}

module.exports = {
  toTally,
};
