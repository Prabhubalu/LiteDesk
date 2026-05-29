const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeDiscountAmount,
  computeLineTotals,
  computeQuoteTotalsFromLines
} = require('../../services/quoteTotalsService');

test('computeDiscountAmount: explicit discountAmount wins and caps at subtotal', () => {
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountAmount: 15 }), 15);
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountAmount: 999 }), 100);
});

test('computeDiscountAmount: percent and amount types', () => {
  assert.equal(computeDiscountAmount({ lineSubtotal: 200, discountType: 'percent', discountValue: 10 }), 20);
  assert.equal(computeDiscountAmount({ lineSubtotal: 200, discountType: 'amount', discountValue: 25 }), 25);
});

test('computeDiscountAmount: zero explicit amount does not block percent', () => {
  assert.equal(
    computeDiscountAmount({
      lineSubtotal: 200,
      discountType: 'percent',
      discountValue: 100,
      discountAmount: 0
    }),
    200
  );
});

test('computeLineTotals: subtotal cannot go negative', () => {
  const t = computeLineTotals({
    quantity: 1,
    unitPriceSnapshot: 100,
    discountAmount: 150
  });
  assert.equal(t.lineSubtotal, 0);
  assert.equal(t.lineTaxTotal, 0);
  assert.equal(t.lineTotal, 0);
});

test('computeQuoteTotalsFromLines: ignores hiddenLine', () => {
  const totals = computeQuoteTotalsFromLines([
    { hiddenLine: false, lineSubtotal: 10, lineTaxTotal: 0, lineTotal: 10 },
    { hiddenLine: true, lineSubtotal: 999, lineTaxTotal: 0, lineTotal: 999 }
  ]);
  assert.deepEqual(totals, {
    subtotal: 10,
    lineDiscountTotal: 0,
    taxTotal: 0,
    globalDiscountTotal: 0,
    adjustmentTotal: 0,
    grandTotal: 10
  });
});

test('computeQuoteTotalsFromLines: fixed bundle counts parent only', () => {
  const parentId = 'parent-1';
  const totals = computeQuoteTotalsFromLines([
    { _id: parentId, lineType: 'bundle_parent', bundleSnapshot: { pricingMode: 'fixed' }, hiddenLine: false, lineSubtotal: 100, lineTaxTotal: 0, lineTotal: 100 },
    { lineType: 'bundle_component', parentBundleLineId: parentId, hiddenLine: false, lineSubtotal: 60, lineTaxTotal: 0, lineTotal: 60 },
    { lineType: 'bundle_component', parentBundleLineId: parentId, hiddenLine: false, lineSubtotal: 40, lineTaxTotal: 0, lineTotal: 40 }
  ]);
  assert.deepEqual(totals, {
    subtotal: 100,
    lineDiscountTotal: 0,
    taxTotal: 0,
    globalDiscountTotal: 0,
    adjustmentTotal: 0,
    grandTotal: 100
  });
});

test('computeQuoteTotalsFromLines: rollup bundle counts components only', () => {
  const parentId = 'parent-2';
  const totals = computeQuoteTotalsFromLines([
    { _id: parentId, lineType: 'bundle_parent', bundleSnapshot: { pricingMode: 'rollup' }, hiddenLine: false, lineSubtotal: 999, lineTaxTotal: 0, lineTotal: 999 },
    { lineType: 'bundle_component', parentBundleLineId: parentId, hiddenLine: false, lineSubtotal: 60, lineTaxTotal: 0, lineTotal: 60 },
    { lineType: 'bundle_component', parentBundleLineId: parentId, hiddenLine: false, lineSubtotal: 40, lineTaxTotal: 0, lineTotal: 40 }
  ]);
  assert.deepEqual(totals, {
    subtotal: 100,
    lineDiscountTotal: 0,
    taxTotal: 0,
    globalDiscountTotal: 0,
    adjustmentTotal: 0,
    grandTotal: 100
  });
});

test('computeQuoteTotalsFromLines: global percent discount', () => {
  const totals = computeQuoteTotalsFromLines(
    [{ lineSubtotal: 200, lineTaxTotal: 0, lineTotal: 200, quantity: 1, unitPriceSnapshot: 200 }],
    { globalDiscountType: 'percent', globalDiscountValue: 10 }
  );
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.globalDiscountTotal, 20);
  assert.equal(totals.grandTotal, 180);
});

