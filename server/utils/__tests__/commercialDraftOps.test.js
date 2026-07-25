const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLineReorderOpsOrThrow,
  normalizeSectionReorderOpsOrThrow,
  applyGlobalDiscountFields,
  applySectionDiscountFields
} = require('../applyCommercialLineCommercialFields');
const { enrichTotalsWithDocumentMoney } = require('../applyDocumentTaxesCharges');

describe('normalizeLineReorderOpsOrThrow', () => {
  it('builds bulkWrite ops for salesOrderLineId', () => {
    const ops = normalizeLineReorderOpsOrThrow(
      [
        { salesOrderLineId: 'l1', lineOrder: 2 },
        { salesOrderLineId: 'l2', lineOrder: 1 }
      ],
      {
        lineIdField: 'salesOrderLineId',
        parentIdField: 'salesOrderId',
        parentId: 'so1',
        organizationId: 'org1'
      }
    );
    assert.equal(ops.length, 2);
    assert.deepEqual(ops[0].updateOne.filter, {
      organizationId: 'org1',
      salesOrderId: 'so1',
      salesOrderLineId: 'l1'
    });
    assert.deepEqual(ops[0].updateOne.update, { $set: { lineOrder: 2 } });
  });

  it('rejects empty orders and duplicates', () => {
    assert.throws(
      () =>
        normalizeLineReorderOpsOrThrow([], {
          lineIdField: 'invoiceLineId',
          parentIdField: 'invoiceId',
          parentId: 'inv1',
          organizationId: 'org1'
        }),
      (err) => err.code === 'VALIDATION'
    );
    assert.throws(
      () =>
        normalizeLineReorderOpsOrThrow(
          [
            { invoiceLineId: 'a', lineOrder: 1 },
            { invoiceLineId: 'a', lineOrder: 2 }
          ],
          {
            lineIdField: 'invoiceLineId',
            parentIdField: 'invoiceId',
            parentId: 'inv1',
            organizationId: 'org1'
          }
        ),
      (err) => err.code === 'VALIDATION'
    );
  });
});

describe('normalizeSectionReorderOpsOrThrow', () => {
  it('builds bulkWrite ops for section uuid field', () => {
    const ops = normalizeSectionReorderOpsOrThrow(
      [{ salesOrderSectionId: 's1', sectionOrder: 0 }],
      {
        sectionIdField: 'salesOrderSectionId',
        parentIdField: 'salesOrderId',
        parentId: 'so1',
        organizationId: 'org1'
      }
    );
    assert.equal(ops.length, 1);
    assert.equal(ops[0].updateOne.filter.salesOrderSectionId, 's1');
    assert.equal(ops[0].updateOne.update.$set.sectionOrder, 0);
  });
});

describe('applyGlobalDiscountFields', () => {
  it('applies type/value and resets amount when amount omitted', () => {
    const doc = {
      globalDiscountType: null,
      globalDiscountValue: 0,
      globalDiscountAmount: 9
    };
    applyGlobalDiscountFields(doc, {
      globalDiscountType: 'percent',
      globalDiscountValue: 10
    });
    assert.equal(doc.globalDiscountType, 'percent');
    assert.equal(doc.globalDiscountValue, 10);
    assert.equal(doc.globalDiscountAmount, 0);
  });

  it('rejects negative globalDiscountValue', () => {
    assert.throws(
      () => applyGlobalDiscountFields({}, { globalDiscountValue: -1 }),
      (err) => err.code === 'VALIDATION'
    );
  });
});

describe('applySectionDiscountFields', () => {
  it('applies section discount inputs', () => {
    const section = {
      sectionDiscountType: null,
      sectionDiscountValue: 0,
      sectionDiscountAmount: 5
    };
    applySectionDiscountFields(section, {
      sectionDiscountType: 'amount',
      sectionDiscountValue: 12,
      sectionDiscountAmount: 12
    });
    assert.equal(section.sectionDiscountType, 'amount');
    assert.equal(section.sectionDiscountValue, 12);
    assert.equal(section.sectionDiscountAmount, 12);
  });
});

describe('enrichTotalsWithDocumentMoney', () => {
  it('merges txn tax and charges into base totals', () => {
    const enriched = enrichTotalsWithDocumentMoney({
      baseTotals: {
        subtotal: 100,
        lineDiscountTotal: 0,
        globalDiscountTotal: 0,
        taxTotal: 0,
        grandTotal: 100
      },
      lines: [
        {
          quantity: 1,
          unitPriceSnapshot: 100,
          discountType: null,
          discountValue: 0,
          discountAmount: 0,
          lineSubtotal: 100,
          lineTaxTotal: 0,
          lineTotal: 100,
          taxSnapshot: { taxes: [] }
        }
      ],
      transactionTaxSnapshot: {
        taxes: [{ taxId: 't1', name: 'GST', taxType: 'PERCENTAGE', taxValue: 10, scope: 'TRANSACTION' }]
      },
      chargesTotal: 5,
      globalDiscountType: null,
      globalDiscountValue: 0,
      globalDiscountAmount: 0,
      adjustmentTotal: 0
    });

    assert.ok(Number(enriched.chargesTotal) >= 0);
    assert.ok(Number.isFinite(Number(enriched.grandTotal)));
    assert.ok(Number(enriched.grandTotal) >= Number(enriched.chargesTotal || 0));
    assert.ok(enriched.taxDocumentSnapshot != null);
  });
});
