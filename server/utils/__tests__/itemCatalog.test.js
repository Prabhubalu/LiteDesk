const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sortMediaEntries,
  resolvePrimaryMediaUrl
} = require('../../services/itemMediaService');
const { inferBarcodeTypeFromValue } = require('../../constants/catalogBarcode');

test('sortMediaEntries orders by sortOrder then uploadedAt', () => {
  const sorted = sortMediaEntries([
    { sortOrder: 2, uploadedAt: new Date('2024-01-02') },
    { sortOrder: 1, uploadedAt: new Date('2024-01-03') }
  ]);
  assert.equal(sorted[0].sortOrder, 1);
  assert.equal(sorted[1].sortOrder, 2);
});

test('resolvePrimaryMediaUrl prefers isPrimary image', () => {
  const url = resolvePrimaryMediaUrl([
    { url: '/a.png', kind: 'image', isPrimary: false, sortOrder: 0 },
    { url: '/b.png', kind: 'image', isPrimary: true, sortOrder: 1 }
  ]);
  assert.equal(url, '/b.png');
});

test('inferBarcodeTypeFromValue detects common lengths', () => {
  assert.equal(inferBarcodeTypeFromValue('5901234123457'), 'EAN13');
  assert.equal(inferBarcodeTypeFromValue('036000291452'), 'UPC');
});
