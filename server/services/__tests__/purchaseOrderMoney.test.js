/**
 * PO document money conventions used by procurementService recalculate / fallback.
 */
const assert = require('assert');
const {
  recalculateDocumentMoney,
  taxesFromSnapshot
} = require('../commercialTaxApplicationService');

function overallDiscountAmount(subtotal, type, value) {
  const gross = Math.max(0, Number(subtotal) || 0);
  const dv = Number(value) || 0;
  const t = String(type || '').toLowerCase();
  if (!t || !(dv > 0)) return 0;
  if (t === 'percent' || t === 'percentage') return Math.min((gross * dv) / 100, gross);
  if (t === 'amount' || t === 'fixed') return Math.min(dv, gross);
  return 0;
}

function applyHeaderMoney(subtotal, taxTotal, chargesTotal, type, value, adjustmentTotal) {
  const discountTotal = overallDiscountAmount(subtotal, type, value);
  const preTaxTotal = Math.max(0, subtotal - discountTotal + (Number(chargesTotal) || 0));
  const grandTotal = Math.max(0, preTaxTotal + (Number(taxTotal) || 0) + (Number(adjustmentTotal) || 0));
  return { discountTotal, preTaxTotal, grandTotal };
}

{
  const r = applyHeaderMoney(1000, 180, 50, 'percent', 10, 25);
  assert.strictEqual(r.discountTotal, 100);
  assert.strictEqual(r.preTaxTotal, 950); // 1000 - 100 + 50
  assert.strictEqual(r.grandTotal, 1155); // 950 + 180 + 25
}

{
  const money = recalculateDocumentMoney({
    lines: [
      {
        _id: 'l1',
        quantity: 2,
        unitPriceSnapshot: 100,
        unitPrice: 100,
        taxSnapshot: { taxes: [] }
      }
    ],
    transactionTaxes: [],
    chargesTotal: 10,
    globalDiscountType: 'amount',
    globalDiscountValue: 20,
    adjustmentTotal: 5
  });
  assert.strictEqual(money.totals.subtotal, 200);
  assert.strictEqual(money.totals.globalDiscountTotal, 20);
  assert.strictEqual(money.totals.chargesTotal, 10);
  assert.strictEqual(money.totals.adjustmentTotal, 5);
  assert.strictEqual(money.totals.grandTotal, 195); // 200 - 20 + 0 + 10 + 5
}

{
  const snap = taxesFromSnapshot({ taxes: [{ taxId: 't1', rate: 10 }] });
  assert.ok(Array.isArray(snap));
}

console.log('purchaseOrderMoney.test.js: ok');
