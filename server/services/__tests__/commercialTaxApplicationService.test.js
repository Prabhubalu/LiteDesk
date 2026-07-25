const assert = require('assert');
const {
  applyTaxesToLine,
  recalculateDocumentMoney,
  taxesFromSnapshot
} = require('../commercialTaxApplicationService');
const { TAX_TYPES, TAX_SCOPES } = require('../../constants/taxConstants');

function run() {
  const gst = {
    taxId: 't1',
    name: 'GST 18%',
    taxType: TAX_TYPES.PERCENTAGE,
    taxValue: 18,
    scope: TAX_SCOPES.ITEM
  };

  const applied = applyTaxesToLine(
    { quantity: 2, unitPriceSnapshot: 50000, discountType: null, discountValue: 0 },
    [gst]
  );
  assert.equal(applied.lineSubtotal, 100000);
  assert.equal(applied.lineTaxTotal, 18000);
  assert.equal(applied.lineTotal, 118000);
  assert.equal(applied.taxSnapshot.mode, 'engine');
  assert.equal(applied.taxSnapshot.source, 'taxCalculationService');
  assert.equal(applied.taxSnapshot.taxes.length, 1);

  const fromSnap = taxesFromSnapshot(applied.taxSnapshot);
  assert.equal(fromSnap.length, 1);
  assert.equal(fromSnap[0].taxValue, 18);

  const lux = {
    taxId: 't2',
    name: 'Luxury',
    taxType: TAX_TYPES.PERCENTAGE,
    taxValue: 10,
    scope: TAX_SCOPES.TRANSACTION
  };

  const doc = recalculateDocumentMoney({
    lines: [
      {
        quantity: 1,
        unitPriceSnapshot: 100000,
        taxSnapshot: applied.taxSnapshot,
        lineSubtotal: 100000,
        lineTaxTotal: 18000
      }
    ],
    transactionTaxes: [lux],
    chargesTotal: 3000,
    adjustmentTotal: 0
  });

  assert.ok(doc.totals.taxTotal > 0);
  assert.equal(doc.totals.chargesTotal, 3000);
  assert.equal(doc.taxDocumentSnapshot.mode, 'engine');
  // item tax 18000 + txn tax on (100000+3000)*10% = 10300 → taxTotal 28300
  assert.equal(doc.totals.itemTaxTotal, 18000);
  assert.equal(doc.totals.transactionTaxTotal, 10300);
  assert.equal(doc.totals.taxTotal, 28300);
  assert.equal(doc.totals.grandTotal, 100000 + 28300 + 3000);

  console.log('commercialTaxApplicationService.test.js: ok');
}

run();
