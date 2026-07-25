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

const priced = calculatePrice({
  basePrice: 1000,
  quantity: 20,
  rules: [{ type: 'volume', minQty: 10, discountPercent: 5 }],
  promotions: [{ type: 'percent', value: 10 }]
});
assert.equal(priced.unitPrice, 855);

console.log('cpqService.test.js: ok');
