'use strict';

const { formatTallyDate } = require('./salesVoucherMapper');
const { buildGstTaxSnapshot } = require('../../../indiaGstTaxService');

/**
 * PurchaseBill → Tally Purchase voucher
 */

function resolveGst(bill = {}, lines = [], opts = {}) {
  const existing =
    bill.taxDocumentSnapshot &&
    bill.taxDocumentSnapshot.schemaVersion === 1 &&
    Array.isArray(bill.taxDocumentSnapshot.lines)
      ? bill.taxDocumentSnapshot
      : null;
  if (existing) return existing;

  try {
    return buildGstTaxSnapshot({
      lines: lines.map((line) => ({
        lineId: line.purchaseBillLineId || (line._id ? String(line._id) : null),
        taxableAmount: Number(line.lineSubtotal) || 0,
        ratePercent: Number(line.taxSnapshot?.ratePercent ?? line.taxSnapshot?.rate ?? 0) || 0,
        hsnSac: line.taxSnapshot?.hsnSac || null,
      })),
      sellerStateCode: opts.sellerStateCode || bill.placeOfSupply || null,
      buyerStateCode: opts.buyerStateCode || null,
      placeOfSupplyStateCode: bill.placeOfSupply || null,
      partyGstin: bill.partyGstin || null,
    });
  } catch (_err) {
    return null;
  }
}

/**
 * @param {object} bill - PurchaseBill
 * @param {object[]} [lines] - PurchaseBillLine[]
 * @param {{ partyLedgerName?: string, purchaseLedgerName?: string }} [opts]
 */
function toTally(bill = {}, lines = [], opts = {}) {
  const gstSnapshot = resolveGst(bill, lines, opts);
  const voucherNumber = bill.purchaseBillNumber || null;

  return {
    voucherType: 'Purchase',
    date: formatTallyDate(bill.billDate || bill.postedAt),
    voucherNumber,
    reference: voucherNumber,
    partyLedgerName: opts.partyLedgerName || null,
    partyGstin: bill.partyGstin || null,
    placeOfSupply: bill.placeOfSupply || gstSnapshot?.placeOfSupply?.stateCode || null,
    isInterstate: gstSnapshot?.placeOfSupply?.isInterstate ?? null,
    currency: bill.currency || null,
    subtotal: Number(bill.subtotal) || 0,
    taxTotal: Number(bill.taxTotal) || 0,
    grandTotal: Number(bill.grandTotal) || 0,
    gstSnapshot,
    inventoryEntries: lines.map((line) => ({
      stockItemName: line.itemNameSnapshot || line.skuSnapshot || null,
      sku: line.skuSnapshot || null,
      quantity: Number(line.quantity) || 0,
      rate: Number(line.unitPrice) || 0,
      amount: Number(line.lineTotal) || Number(line.lineSubtotal) || 0,
      discountAmount: Number(line.discountAmount) || 0,
      unit: line.unitOfMeasure || null,
      hsnSac: line.taxSnapshot?.hsnSac || null,
      arivuLineId: line.purchaseBillLineId || (line._id ? String(line._id) : null),
    })),
    ledgerEntries: [
      {
        ledgerName: opts.partyLedgerName || 'Party',
        isPartyLedger: true,
        amount: Number(bill.grandTotal) || 0,
      },
      {
        ledgerName: opts.purchaseLedgerName || 'Purchase',
        isPartyLedger: false,
        amount: -(Number(bill.subtotal) || 0),
      },
    ],
    arivuId: bill._id ? String(bill._id) : null,
    purchaseBillId: bill.purchaseBillId || null,
  };
}

module.exports = {
  toTally,
};
