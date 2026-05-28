const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  splitItemPayload,
  hasVariantPayloadFields,
  buildItemCompatFieldsFromVariant,
  applyFlatCompatShim,
  applyFlatCompatShimForDetail
} = require('../../constants/catalogFieldOwnership');

test('splitItemPayload routes sellable fields to variant', () => {
  const { parentPayload, variantPayload } = splitItemPayload({
    item_name: 'Widget',
    item_code: 'W-001',
    selling_price: 99,
    tax_type: 'GST',
    description: 'A widget'
  });

  assert.equal(parentPayload.item_name, 'Widget');
  assert.equal(parentPayload.description, 'A widget');
  assert.equal(variantPayload.variant_code, 'W-001');
  assert.equal(variantPayload.selling_price, 99);
  assert.equal(variantPayload.tax_type, 'GST');
});

test('applyFlatCompatShimForDetail mirrors default variant onto item shape', () => {
  const shimmed = applyFlatCompatShimForDetail(
    { item_name: 'Widget', item_code: 'OLD', selling_price: 1 },
    {
      _id: '507f1f77bcf86cd799439011',
      variant_code: 'SKU-NEW',
      selling_price: 42,
      cost_price: 10,
      currency: 'EUR',
      unit_of_measure: 'ea',
      tax_type: 'VAT',
      tax_percentage: 20,
      commission_rate: 5
    }
  );

  assert.equal(shimmed.item_code, 'SKU-NEW');
  assert.equal(shimmed.selling_price, 42);
  assert.equal(shimmed.currency, 'EUR');
  assert.equal(shimmed.catalogVariantId, '507f1f77bcf86cd799439011');
  assert.equal(shimmed.defaultVariant.variant_code, 'SKU-NEW');
});

test('hasVariantPayloadFields detects non-empty variant payload', () => {
  assert.equal(hasVariantPayloadFields({ selling_price: 10 }), true);
  assert.equal(hasVariantPayloadFields({}), false);
});
