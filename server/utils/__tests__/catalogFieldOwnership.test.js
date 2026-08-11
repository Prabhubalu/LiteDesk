const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  splitItemPayload,
  hasVariantPayloadFields,
  buildItemCompatFieldsFromVariant,
  applyFlatCompatShim,
  applyFlatCompatShimForDetail
} = require('../../constants/catalogFieldOwnership');

test('splitItemPayload routes sellable fields to variant; keeps system item_code on parent', () => {
  const { parentPayload, variantPayload } = splitItemPayload({
    item_name: 'Widget',
    item_code: 'ITM-000001',
    variant_code: 'SKU-W',
    selling_price: 99,
    tax_type: 'GST',
    description: 'A widget'
  });

  assert.equal(parentPayload.item_name, 'Widget');
  assert.equal(parentPayload.description, 'A widget');
  assert.equal(parentPayload.item_code, 'ITM-000001');
  assert.equal(variantPayload.variant_code, 'SKU-W');
  assert.equal(variantPayload.selling_price, 99);
  assert.equal(variantPayload.tax_type, 'GST');
  assert.equal(variantPayload.item_code, undefined);
});

test('applyFlatCompatShimForDetail dual-writes prices but never overwrites system item_code', () => {
  const shimmed = applyFlatCompatShimForDetail(
    { item_name: 'Widget', item_code: 'ITM-000001', selling_price: 1 },
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

  assert.equal(shimmed.item_code, 'ITM-000001');
  assert.equal(shimmed.selling_price, 42);
  assert.equal(shimmed.currency, 'EUR');
  assert.equal(shimmed.catalogVariantId, '507f1f77bcf86cd799439011');
  assert.equal(shimmed.defaultVariant.variant_code, 'SKU-NEW');
});

test('buildItemCompatFieldsFromVariant does not map variant_code to item_code', () => {
  const compat = buildItemCompatFieldsFromVariant({
    variant_code: 'SKU-X',
    selling_price: 10,
    currency: 'USD'
  });
  assert.equal(compat.item_code, undefined);
  assert.equal(compat.selling_price, 10);
  assert.equal(compat.currency, 'USD');
});

test('hasVariantPayloadFields detects non-empty variant payload', () => {
  assert.equal(hasVariantPayloadFields({ selling_price: 10 }), true);
  assert.equal(hasVariantPayloadFields({}), false);
  assert.equal(hasVariantPayloadFields(splitItemPayload({ item_code: 'X', item_name: 'A' }).variantPayload), false);
});
