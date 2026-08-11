const assert = require('assert');
const {
  cartesian,
  comboKey,
  validateConfiguration,
  calculatePrice,
  previewVariants
} = require('../cpqService');

const combos = cartesian([
  { name: 'Color', values: ['Black', 'White'], isVariantAttribute: true },
  { name: 'Storage', values: ['128', '256'], isVariantAttribute: true }
]);
assert.equal(combos.length, 4);
assert.ok(comboKey(combos[0]).includes('Color='));

const preview = previewVariants({
  name: 'Phone',
  attributes: [
    { name: 'Color', values: ['Black', 'White'], isVariantAttribute: true },
    { name: 'Storage', values: ['128'], isVariantAttribute: true }
  ]
});
assert.equal(preview.count, 2);
assert.equal(preview.generation.state, 'none');
assert.equal(preview.variants.every((v) => v.exists === false), true);

// Stable keys regardless of attribute order
assert.equal(
  comboKey([{ name: 'Storage', value: '128' }, { name: 'Color', value: 'Black' }]),
  comboKey([{ name: 'Color', value: 'Black' }, { name: 'Storage', value: '128' }])
);

const withExisting = previewVariants(
  {
    name: 'Phone',
    attributes: [
      { name: 'Color', values: ['Black', 'White'], isVariantAttribute: true },
      { name: 'Storage', values: ['128'], isVariantAttribute: true }
    ]
  },
  [{ attributeValues: { Color: 'Black', Storage: '128' }, item_name: 'Phone - Black - 128', _id: '1' }]
);
assert.equal(withExisting.generation.generated, 1);
assert.equal(withExisting.generation.missing, 1);
assert.equal(withExisting.generation.state, 'partial');
assert.equal(withExisting.variants.filter((v) => v.exists).length, 1);

const valid = validateConfiguration(
  {
    options: [{ optionName: 'Processor', required: true }],
    productRules: [{ type: 'max', optionName: 'Processor', max: 1 }],
    compatibilityRules: [],
    dependencyRules: [{ whenOption: 'Warranty', whenValue: '3Y', requireOption: 'Support' }]
  },
  { Processor: 'i7', Warranty: '3Y', Support: 'Premium' }
);
assert.equal(valid.valid, true);

const invalid = validateConfiguration(
  {
    options: [{ optionName: 'Processor', required: true }],
    productRules: [],
    compatibilityRules: [],
    dependencyRules: []
  },
  {}
);
assert.equal(invalid.valid, false);

// Compatibility (incompatible pairs)
const compatFail = validateConfiguration(
  {
    options: [
      { optionName: 'Board', required: true },
      { optionName: 'CPU', required: true }
    ],
    productRules: [],
    compatibilityRules: [{
      optionA: 'Board',
      optionB: 'CPU',
      mode: 'incompatible_with',
      pairs: [['Intel', 'AMD Ryzen']]
    }],
    dependencyRules: []
  },
  { Board: 'Intel', CPU: 'AMD Ryzen' }
);
assert.equal(compatFail.valid, false);
assert.ok(compatFail.errors.some((e) => e.code === 'INCOMPATIBLE'));

// Compatible allowlist
const compatOk = validateConfiguration(
  {
    options: [
      { optionName: 'Board', required: true },
      { optionName: 'CPU', required: true }
    ],
    productRules: [],
    compatibilityRules: [{
      optionA: 'Board',
      optionB: 'CPU',
      mode: 'compatible_with',
      pairs: [['Intel', 'i7'], ['AMD', 'Ryzen']]
    }],
    dependencyRules: []
  },
  { Board: 'Intel', CPU: 'i7' }
);
assert.equal(compatOk.valid, true);

// Dependency auto-add
const depAdd = validateConfiguration(
  {
    options: [
      { optionName: 'Warranty', required: false },
      { optionName: 'Support', required: false, optionType: 'dropdown', values: ['Premium'] }
    ],
    productRules: [],
    compatibilityRules: [],
    dependencyRules: [{
      whenOption: 'Warranty',
      whenValues: ['3 Years'],
      action: 'add',
      targetOption: 'Support',
      targetValue: 'Premium'
    }]
  },
  { Warranty: '3 Years' }
);
assert.equal(depAdd.valid, true);
assert.equal(depAdd.selections.Support, 'Premium');
assert.ok(depAdd.appliedDependencies.some((d) => d.action === 'add'));

// Min multi-select
const minRule = validateConfiguration(
  {
    options: [{ optionName: 'Display', required: false, optionType: 'multi_select' }],
    productRules: [{ type: 'min', optionName: 'Display', min: 1 }],
    compatibilityRules: [],
    dependencyRules: []
  },
  { Display: [] }
);
assert.equal(minRule.valid, false);
assert.ok(minRule.errors.some((e) => e.code === 'MIN_SELECTION'));

const priced = calculatePrice({
  basePrice: 1000,
  quantity: 20,
  rules: [{ type: 'volume', minQty: 10, discountPercent: 5 }],
  promotions: [{ type: 'percent', value: 10 }]
});
assert.equal(priced.unitPrice, 855);

console.log('cpqService.test.js: ok');
