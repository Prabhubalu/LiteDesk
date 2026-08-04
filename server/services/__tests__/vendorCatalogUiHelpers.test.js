/**
 * Vendor catalog pure helpers — import CSV row mapping + status normalize.
 */
const assert = require('assert');

function normalizeStatus(raw, fallback = 'Active') {
  const s = String(raw || fallback).trim();
  if (s.toLowerCase() === 'inactive') return 'Inactive';
  return 'Active';
}

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function filterHitsForPoScope(hits, scope) {
  const rows = Array.isArray(hits) ? hits : [];
  if (scope === 'all') return rows;
  return rows.filter((h) => h?.linked !== false);
}

function assertNoForeignItemsInLinked(hits, allowedVariantIds) {
  const allowed = new Set((allowedVariantIds || []).map(String));
  for (const h of filterHitsForPoScope(hits, 'linked')) {
    assert.ok(allowed.has(String(h._id)), `unexpected variant ${h._id} in linked scope`);
  }
}

// Tests
assert.strictEqual(normalizeStatus('inactive'), 'Inactive');
assert.strictEqual(normalizeStatus('Active'), 'Active');
assert.strictEqual(normalizeStatus(null), 'Active');

const cells = parseCsvLine('a,"b,c",d');
assert.deepStrictEqual(cells, ['a', 'b,c', 'd']);

const linkedOnly = filterHitsForPoScope(
  [
    { _id: '1', linked: true },
    { _id: '2', linked: false },
    { _id: '3' }
  ],
  'linked'
);
assert.strictEqual(linkedOnly.length, 2);
assert.deepStrictEqual(
  linkedOnly.map((h) => h._id),
  ['1', '3']
);

assertNoForeignItemsInLinked(
  [
    { _id: 'a', linked: true },
    { _id: 'b', linked: false }
  ],
  ['a', 'c']
);

console.log('vendorCatalogUiHelpers.test.js: ok');
