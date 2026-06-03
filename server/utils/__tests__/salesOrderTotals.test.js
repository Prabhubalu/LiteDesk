const test = require('node:test');
const assert = require('node:assert/strict');

const { computeOrderTotalsWithSections } = require('../../services/salesOrderTotalsService');

test('computeOrderTotalsWithSections: section discount before global discount', () => {
  const sections = [
    {
      _id: 's1',
      salesOrderSectionId: 'sec-1',
      sectionType: 'standard',
      includeInOrderTotal: true,
      sectionDiscountType: 'amount',
      sectionDiscountValue: 20
    }
  ];
  const lines = [
    {
      salesOrderSectionId: 's1',
      quantity: 1,
      unitPriceSnapshot: 200,
      lineSubtotal: 200,
      lineTaxTotal: 0,
      lineTotal: 200
    }
  ];

  const { orderTotals } = computeOrderTotalsWithSections(sections, lines, {
    globalDiscountType: 'amount',
    globalDiscountValue: 10
  });

  assert.equal(orderTotals.subtotal, 180);
  assert.equal(orderTotals.globalDiscountTotal, 10);
  assert.equal(orderTotals.grandTotal, 170);
});
