const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeAcceptedSectionIds,
  buildConversionSectionBreakdown,
  buildConversionMetadata
} = require('../../services/quoteConversionService');

const sections = [
  { _id: 's1', quoteSectionId: 'sec-uuid-1', sectionTitle: 'Hardware', sectionType: 'standard', sectionOrder: 0, sectionTotal: 100 },
  { _id: 's2', quoteSectionId: 'sec-uuid-2', sectionTitle: 'Services', sectionType: 'standard', sectionOrder: 1, sectionTotal: 50 }
];

const lines = [
  { quoteLineId: 'l1', quoteSectionId: 's1', lineType: 'standard', hiddenLine: false },
  { quoteLineId: 'l2', quoteSectionId: 's2', lineType: 'standard', hiddenLine: false }
];

test('computeAcceptedSectionIds: full section when all lines selected', () => {
  const ids = computeAcceptedSectionIds(sections, lines, ['l1']);
  assert.deepEqual(ids, ['sec-uuid-1']);
});

test('computeAcceptedSectionIds: multiple sections when fully selected', () => {
  const ids = computeAcceptedSectionIds(sections, lines, ['l1', 'l2']);
  assert.deepEqual(ids, ['sec-uuid-1', 'sec-uuid-2']);
});

test('buildConversionSectionBreakdown: marks accepted sections', () => {
  const breakdown = buildConversionSectionBreakdown(sections, lines, ['l1', 'l2']);
  assert.equal(breakdown.length, 2);
  assert.equal(breakdown[0].accepted, true);
  assert.equal(breakdown[1].accepted, true);
  assert.equal(breakdown[0].quoteSectionId, 'sec-uuid-1');
});

test('buildConversionMetadata: includes section fields', () => {
  const quote = {
    status: 'Partially Accepted',
    grandTotal: 150,
    currency: 'USD',
    customerResponse: {
      responseType: 'partial',
      acceptedLineIds: ['l1'],
      acceptedGrandTotal: 100
    }
  };

  const meta = buildConversionMetadata(quote, {}, { sections, lines });
  assert.deepEqual(meta.acceptedLineIds, ['l1']);
  assert.deepEqual(meta.acceptedSectionIds, ['sec-uuid-1']);
  assert.equal(meta.sectionBreakdown.length, 2);
  assert.equal(meta.quoteCurrency, 'USD');
});
