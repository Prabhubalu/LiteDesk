const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isCatalogBundlePricingMode,
  isCatalogBundleType,
  CATALOG_BUNDLE_PRICING_MODES,
  CATALOG_BUNDLE_PRICING_DEFAULT,
  CATALOG_BUNDLE_TYPES,
  validateBundleDefinition,
  resolveIncludedComponents,
  validateBundleConfiguration,
  computeBundleUnitPrice,
  assertBundleEffective
} = require('../../constants/catalogBundle');

test('bundle pricing modes and types are defined', () => {
  assert.deepEqual(CATALOG_BUNDLE_PRICING_MODES, ['fixed', 'rollup', 'discount']);
  assert.equal(CATALOG_BUNDLE_PRICING_DEFAULT, 'fixed');
  assert.deepEqual(CATALOG_BUNDLE_TYPES, ['fixed', 'flexible']);
  assert.equal(isCatalogBundlePricingMode('discount'), true);
  assert.equal(isCatalogBundleType('flexible'), true);
  assert.equal(isCatalogBundleType('invalid'), false);
});

test('fixed bundle rejects optional components', () => {
  assert.throws(
    () =>
      validateBundleDefinition({
        bundleType: 'fixed',
        pricingMode: 'fixed',
        components: [
          { componentVariantId: 'a', quantity: 1, isOptional: false },
          { componentVariantId: 'b', quantity: 1, isOptional: true }
        ]
      }),
    (err) => err.code === 'VALIDATION' && /optional/i.test(err.message)
  );
});

test('discount pricing requires discount fields', () => {
  assert.throws(
    () =>
      validateBundleDefinition({
        bundleType: 'fixed',
        pricingMode: 'discount',
        components: [{ componentVariantId: 'a', quantity: 1, isOptional: false }],
        discountType: null,
        discountValue: 10
      }),
    (err) => err.code === 'VALIDATION'
  );

  const ok = validateBundleDefinition({
    bundleType: 'fixed',
    pricingMode: 'discount',
    components: [{ componentVariantId: 'a', quantity: 1, isOptional: false }],
    discountType: 'percent',
    discountValue: 10
  });
  assert.equal(ok.discountType, 'percent');
  assert.equal(ok.discountValue, 10);
});

test('default selected optional components are included when list omitted', () => {
  const components = [
    { componentVariantId: 'lap', isOptional: false },
    { componentVariantId: 'mouse', isOptional: true, defaultSelected: true },
    { componentVariantId: 'bag', isOptional: true, defaultSelected: false }
  ];
  const { includedIds, selectedOptionalCount } = resolveIncludedComponents(components, null);
  assert.equal(includedIds.has('lap'), true);
  assert.equal(includedIds.has('mouse'), true);
  assert.equal(includedIds.has('bag'), false);
  assert.equal(selectedOptionalCount, 1);
});

test('flexible min/max optional selection is enforced', () => {
  const components = [
    { componentVariantId: 'lap', isOptional: false },
    { componentVariantId: 'a', isOptional: true },
    { componentVariantId: 'b', isOptional: true },
    { componentVariantId: 'c', isOptional: true }
  ];
  const { includedIds, selectedOptionalCount } = resolveIncludedComponents(components, ['a', 'b', 'c']);
  assert.throws(
    () =>
      validateBundleConfiguration({
        bundleType: 'flexible',
        components,
        includedIds,
        selectedOptionalCount,
        minOptionalSelection: 0,
        maxOptionalSelection: 2,
        quantityOverrides: null
      }),
    (err) => err.details?.rule === 'max_optional_selection'
  );
});

test('max quantity rule is enforced', () => {
  const components = [
    {
      componentVariantId: 'mon',
      isOptional: false,
      editableQuantity: true,
      maxQuantity: 2,
      quantity: 1
    }
  ];
  assert.throws(
    () =>
      validateBundleConfiguration({
        bundleType: 'fixed',
        components,
        includedIds: new Set(['mon']),
        selectedOptionalCount: 0,
        minOptionalSelection: null,
        maxOptionalSelection: null,
        quantityOverrides: { mon: 3 }
      }),
    (err) => err.details?.rule === 'max_quantity'
  );
});

test('computeBundleUnitPrice supports fixed, rollup, discount', () => {
  const fixed = computeBundleUnitPrice({
    pricingMode: 'fixed',
    fixedUnitPrice: 52000,
    includedLineTotals: [50000, 2000, 3000]
  });
  assert.equal(fixed.bundleUnitPrice, 52000);
  assert.equal(fixed.rollupComponentTotal, 55000);

  const rollup = computeBundleUnitPrice({
    pricingMode: 'rollup',
    fixedUnitPrice: 0,
    includedLineTotals: [60000, 8000, 2000, 5000]
  });
  assert.equal(rollup.bundleUnitPrice, 75000);

  const discount = computeBundleUnitPrice({
    pricingMode: 'discount',
    fixedUnitPrice: 0,
    includedLineTotals: [60000, 8000, 2000, 5000],
    discountType: 'amount',
    discountValue: 3000
  });
  assert.equal(discount.bundleUnitPrice, 72000);
  assert.equal(discount.discountApplied, 3000);
});

test('assertBundleEffective blocks out-of-window dates', () => {
  assert.throws(
    () =>
      assertBundleEffective({
        effectiveFrom: new Date('2026-01-01'),
        effectiveUntil: new Date('2026-06-30'),
        asOfDate: new Date('2026-12-01')
      }),
    (err) => err.details?.rule === 'effective_until'
  );
});
