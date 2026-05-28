const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  selectBestEntry,
  entryIsEffective
} = require('../../services/catalogPriceBookEntryService');

test('entryIsEffective respects date window', () => {
  const asOf = new Date('2026-06-01');
  assert.equal(entryIsEffective({ effectiveFrom: null, effectiveTo: null }, asOf), true);
  assert.equal(
    entryIsEffective({ effectiveFrom: new Date('2026-07-01'), effectiveTo: null }, asOf),
    false
  );
  assert.equal(
    entryIsEffective({ effectiveFrom: null, effectiveTo: new Date('2026-05-01') }, asOf),
    false
  );
});

test('selectBestEntry picks highest minQty tier', () => {
  const asOf = new Date('2026-06-01');
  const entries = [
    { _id: 'a', unitPrice: 10, minQty: 1 },
    { _id: 'b', unitPrice: 8, minQty: 10 },
    { _id: 'c', unitPrice: 6, minQty: 100 }
  ];
  const match = selectBestEntry(entries, { quantity: 12, asOf });
  assert.equal(match._id, 'b');
  assert.equal(match.unitPrice, 8);
});

test('selectBestEntry prefers newer effectiveFrom when minQty ties', () => {
  const asOf = new Date('2026-06-01');
  const entries = [
    { _id: 'old', unitPrice: 10, minQty: 1, effectiveFrom: new Date('2025-01-01') },
    { _id: 'new', unitPrice: 12, minQty: 1, effectiveFrom: new Date('2026-01-01') }
  ];
  const match = selectBestEntry(entries, { quantity: 1, asOf });
  assert.equal(match._id, 'new');
});

test('selectBestEntry returns null when no effective entry', () => {
  const asOf = new Date('2026-06-01');
  const entries = [
    { _id: 'future', unitPrice: 10, minQty: 1, effectiveFrom: new Date('2027-01-01') }
  ];
  assert.equal(selectBestEntry(entries, { quantity: 1, asOf }), null);
});
