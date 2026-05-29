const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveCustomerAcceptance,
  getSelectableLines
} = require('../../services/quotePublicAcceptanceService');

const lines = [
  { quoteLineId: 'a', lineType: 'standard', lineSubtotal: 100, lineTaxTotal: 10, lineTotal: 110, hiddenLine: false },
  { quoteLineId: 'b', lineType: 'standard', lineSubtotal: 50, lineTaxTotal: 5, lineTotal: 55, hiddenLine: false },
  {
    quoteLineId: 'p1',
    _id: 'mongo-parent',
    lineType: 'bundle_parent',
    lineSubtotal: 200,
    lineTaxTotal: 20,
    lineTotal: 220,
    hiddenLine: false
  },
  {
    quoteLineId: 'c1',
    lineType: 'bundle_component',
    parentBundleLineId: 'mongo-parent',
    lineSubtotal: 30,
    lineTaxTotal: 3,
    lineTotal: 33,
    hiddenLine: false
  }
];

test('getSelectableLines excludes bundle components', () => {
  const selectable = getSelectableLines(lines);
  assert.equal(selectable.length, 3);
  assert.ok(selectable.every((l) => l.lineType !== 'bundle_component'));
});

test('resolveCustomerAcceptance: full when all selectable chosen', () => {
  const r = resolveCustomerAcceptance(lines, null);
  assert.equal(r.isFull, true);
  assert.equal(r.toStatus, 'Accepted');
  assert.equal(r.acceptedGrandTotal, 110 + 55 + 220 + 33);
});

test('resolveCustomerAcceptance: partial when subset', () => {
  const r = resolveCustomerAcceptance(lines, ['a']);
  assert.equal(r.isFull, false);
  assert.equal(r.toStatus, 'Partially Accepted');
  assert.equal(r.acceptedGrandTotal, 110);
});

test('resolveCustomerAcceptance: bundle parent includes children', () => {
  const r = resolveCustomerAcceptance(lines, ['p1']);
  assert.equal(r.acceptedGrandTotal, 220 + 33);
});
