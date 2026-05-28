const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isCatalogBundlePricingMode,
  CATALOG_BUNDLE_PRICING_MODES,
  CATALOG_BUNDLE_PRICING_DEFAULT
} = require('../../constants/catalogBundle');

test('bundle pricing modes are defined', () => {
  assert.deepEqual(CATALOG_BUNDLE_PRICING_MODES, ['fixed', 'rollup']);
  assert.equal(CATALOG_BUNDLE_PRICING_DEFAULT, 'fixed');
  assert.equal(isCatalogBundlePricingMode('fixed'), true);
  assert.equal(isCatalogBundlePricingMode('rollup'), true);
  assert.equal(isCatalogBundlePricingMode('invalid'), false);
});
