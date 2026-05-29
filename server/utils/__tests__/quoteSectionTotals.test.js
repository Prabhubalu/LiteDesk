const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeSectionTotals,
  computeQuoteTotalsWithSections,
  isSectionIncludedInQuoteTotal
} = require('../../services/quoteTotalsService');

test('isSectionIncludedInQuoteTotal: optional excluded unless includeInQuoteTotal', () => {
  assert.equal(isSectionIncludedInQuoteTotal({ sectionType: 'standard' }), true);
  assert.equal(isSectionIncludedInQuoteTotal({ sectionType: 'optional', includeInQuoteTotal: false }), false);
  assert.equal(isSectionIncludedInQuoteTotal({ sectionType: 'optional', includeInQuoteTotal: true }), true);
  assert.equal(isSectionIncludedInQuoteTotal({ sectionType: 'future' }), false);
  assert.equal(isSectionIncludedInQuoteTotal({ hiddenSection: true }), false);
});

test('computeSectionTotals: line discounts and section percent discount', () => {
  const section = {
    _id: 'sec-1',
    sectionDiscountType: 'percent',
    sectionDiscountValue: 10
  };
  const lines = [
    { quantity: 1, unitPriceSnapshot: 100, lineSubtotal: 90, lineTaxTotal: 0, lineTotal: 90, discountType: 'percent', discountValue: 10 },
    { quantity: 1, unitPriceSnapshot: 50, lineSubtotal: 50, lineTaxTotal: 0, lineTotal: 50 }
  ];

  const result = computeSectionTotals(section, lines);
  assert.equal(result.sectionSubtotal, 140);
  assert.equal(result.sectionLineDiscountTotal, 10);
  assert.equal(result.sectionDiscountTotal, 14);
  assert.equal(result.sectionNet, 126);
  assert.equal(result.sectionTotal, 126);
});

test('computeQuoteTotalsWithSections: optional section excluded from quote subtotal', () => {
  const sections = [
    { _id: 's1', sectionType: 'standard', includeInQuoteTotal: true },
    { _id: 's2', sectionType: 'optional', includeInQuoteTotal: false }
  ];
  const lines = [
    { quoteSectionId: 's1', quantity: 1, unitPriceSnapshot: 100, lineSubtotal: 100, lineTaxTotal: 0, lineTotal: 100 },
    { quoteSectionId: 's2', quantity: 1, unitPriceSnapshot: 50, lineSubtotal: 50, lineTaxTotal: 0, lineTotal: 50 }
  ];

  const { quoteTotals, sectionResults } = computeQuoteTotalsWithSections(sections, lines, {});
  assert.equal(quoteTotals.subtotal, 100);
  assert.equal(quoteTotals.grandTotal, 100);
  assert.equal(sectionResults.length, 2);
  assert.equal(sectionResults[1].sectionSubtotal, 50);
});

test('computeQuoteTotalsWithSections: section discount before global discount', () => {
  const sections = [{ _id: 's1', sectionType: 'standard', sectionDiscountType: 'amount', sectionDiscountValue: 20 }];
  const lines = [
    { quoteSectionId: 's1', quantity: 1, unitPriceSnapshot: 200, lineSubtotal: 200, lineTaxTotal: 0, lineTotal: 200 }
  ];

  const { quoteTotals } = computeQuoteTotalsWithSections(sections, lines, {
    globalDiscountType: 'amount',
    globalDiscountValue: 10
  });

  assert.equal(quoteTotals.subtotal, 180);
  assert.equal(quoteTotals.globalDiscountTotal, 10);
  assert.equal(quoteTotals.grandTotal, 170);
});

test('computeQuoteTotalsWithSections: fixed bundle in section counts parent only', () => {
  const parentId = 'parent-1';
  const sections = [{ _id: 's1', sectionType: 'standard' }];
  const lines = [
    {
      _id: parentId,
      quoteSectionId: 's1',
      lineType: 'bundle_parent',
      bundleSnapshot: { pricingMode: 'fixed' },
      quantity: 1,
      unitPriceSnapshot: 100,
      lineSubtotal: 100,
      lineTaxTotal: 0,
      lineTotal: 100
    },
    {
      quoteSectionId: 's1',
      lineType: 'bundle_component',
      parentBundleLineId: parentId,
      quantity: 1,
      unitPriceSnapshot: 60,
      lineSubtotal: 60,
      lineTaxTotal: 0,
      lineTotal: 60
    }
  ];

  const { quoteTotals } = computeQuoteTotalsWithSections(sections, lines, {});
  assert.equal(quoteTotals.subtotal, 100);
  assert.equal(quoteTotals.grandTotal, 100);
});

test('computeQuoteTotalsWithSections: future section has zero quote contribution', () => {
  const sections = [
    { _id: 's1', sectionType: 'standard' },
    { _id: 's2', sectionType: 'future' }
  ];
  const lines = [
    { quoteSectionId: 's1', quantity: 1, unitPriceSnapshot: 100, lineSubtotal: 100, lineTaxTotal: 0, lineTotal: 100 },
    { quoteSectionId: 's2', quantity: 1, unitPriceSnapshot: 500, lineSubtotal: 500, lineTaxTotal: 0, lineTotal: 500 }
  ];

  const { quoteTotals, sectionResults } = computeQuoteTotalsWithSections(sections, lines, {});
  assert.equal(quoteTotals.subtotal, 100);
  assert.equal(sectionResults[1].sectionSubtotal, 500);
});
