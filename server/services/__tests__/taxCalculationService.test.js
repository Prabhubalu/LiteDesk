const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateDocumentTaxes,
  toCents,
  fromCents
} = require('../taxCalculationService');
const { TAX_TYPES, TAX_SCOPES, TAX_CALC_STEPS } = require('../../constants/taxConstants');

describe('taxCalculationService', () => {
  test('cents helpers round half up', () => {
    assert.equal(toCents(10.005), 1001);
    assert.equal(fromCents(1001), 10.01);
  });

  test('item-level GST on multiple lines', () => {
    const gst = {
      taxId: 't1',
      name: 'GST 18%',
      taxType: TAX_TYPES.PERCENTAGE,
      taxValue: 18,
      scope: TAX_SCOPES.ITEM
    };
    const result = calculateDocumentTaxes({
      lines: [
        { lineId: 'l1', quantity: 2, unitPrice: 50000, taxes: [gst] },
        { lineId: 'l2', quantity: 3, unitPrice: 500, taxes: [gst] }
      ]
    });

    assert.equal(result.subtotal, 101500);
    assert.equal(result.lines[0].lineTaxTotal, 18000);
    assert.equal(result.lines[0].lineTotal, 118000);
    assert.equal(result.lines[1].lineTaxTotal, 270);
    assert.equal(result.itemTaxTotal, 18270);
    assert.equal(result.grandTotal, 119770);
    assert.deepEqual(result.calcSteps, [...TAX_CALC_STEPS]);
  });

  test('transaction tax applies after charges hook', () => {
    const luxury = {
      taxId: 'lux',
      name: 'Luxury Tax 10%',
      taxType: TAX_TYPES.PERCENTAGE,
      taxValue: 10,
      scope: TAX_SCOPES.TRANSACTION
    };
    const result = calculateDocumentTaxes({
      lines: [{ quantity: 1, unitPrice: 100000, taxes: [] }],
      chargesTotal: 3000,
      transactionTaxes: [luxury]
    });

    assert.equal(result.subtotal, 100000);
    assert.equal(result.chargesTotal, 3000);
    assert.equal(result.transactionTaxTotal, 10300);
    assert.equal(result.grandTotal, 113300);
  });

  test('rejects transaction tax on line items', () => {
    assert.throws(
      () => calculateDocumentTaxes({
        lines: [{
          quantity: 1,
          unitPrice: 100,
          taxes: [{ name: 'Lux', taxType: TAX_TYPES.PERCENTAGE, taxValue: 10, scope: TAX_SCOPES.TRANSACTION }]
        }]
      }),
      (err) => err.code === 'TAX_SCOPE_INVALID'
    );
  });

  test('rejects item tax at document level', () => {
    assert.throws(
      () => calculateDocumentTaxes({
        lines: [{ quantity: 1, unitPrice: 100, taxes: [] }],
        transactionTaxes: [{
          name: 'GST',
          taxType: TAX_TYPES.PERCENTAGE,
          taxValue: 18,
          scope: TAX_SCOPES.ITEM
        }]
      }),
      (err) => err.code === 'TAX_SCOPE_INVALID'
    );
  });

  test('rejects fixed amount in MVP', () => {
    assert.throws(
      () => calculateDocumentTaxes({
        lines: [{
          quantity: 1,
          unitPrice: 100,
          taxes: [{
            name: 'Flat',
            taxType: TAX_TYPES.FIXED_AMOUNT,
            taxValue: 5,
            scope: TAX_SCOPES.ITEM
          }]
        }]
      }),
      (err) => err.code === 'TAX_TYPE_UNSUPPORTED'
    );
  });

  test('BOTH scope allowed on lines and document', () => {
    const both = {
      name: 'Env',
      taxType: TAX_TYPES.PERCENTAGE,
      taxValue: 5,
      scope: TAX_SCOPES.BOTH
    };
    const onLine = calculateDocumentTaxes({
      lines: [{ quantity: 1, unitPrice: 200, taxes: [both] }]
    });
    assert.equal(onLine.itemTaxTotal, 10);

    const onDoc = calculateDocumentTaxes({
      lines: [{ quantity: 1, unitPrice: 200, taxes: [] }],
      transactionTaxes: [both]
    });
    assert.equal(onDoc.transactionTaxTotal, 10);
  });
});
