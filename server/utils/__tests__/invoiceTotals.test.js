const test = require('node:test');
const assert = require('node:assert/strict');

const { computeInvoiceTotalsWithSections } = require('../../services/invoiceTotalsService');

test('computeInvoiceTotalsWithSections: section discount before global discount', () => {
  const sections = [
    {
      _id: 's1',
      invoiceSectionId: 'sec-1',
      sectionType: 'standard',
      includeInInvoiceTotal: true,
      sectionDiscountType: 'amount',
      sectionDiscountValue: 20
    }
  ];
  const lines = [
    {
      invoiceSectionId: 's1',
      quantity: 1,
      unitPriceSnapshot: 200,
      lineSubtotal: 200,
      lineTaxTotal: 0,
      lineTotal: 200
    }
  ];

  const { invoiceTotals } = computeInvoiceTotalsWithSections(sections, lines, {
    globalDiscountType: 'amount',
    globalDiscountValue: 10
  });

  assert.equal(invoiceTotals.subtotal, 180);
  assert.equal(invoiceTotals.globalDiscountTotal, 10);
  assert.equal(invoiceTotals.grandTotal, 170);
});
