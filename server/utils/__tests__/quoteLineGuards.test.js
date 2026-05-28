const test = require('node:test');
const assert = require('node:assert/strict');

const {
  userCanOverridePricing,
  assertQuoteCommerciallyEditableForLineWrite,
  assertVariantSellable,
  normalizeReorderOpsOrThrow
} = require('../../controllers/quoteLineController');

const { computeDiscountAmount } = require('../../services/quoteTotalsService');

function reqWithUser(user) {
  return { user };
}

test('userCanOverridePricing: owner/admin allowed', () => {
  assert.equal(userCanOverridePricing(reqWithUser({ isOwner: true, role: 'user' })), true);
  assert.equal(userCanOverridePricing(reqWithUser({ isOwner: false, role: 'admin' })), true);
  assert.equal(userCanOverridePricing(reqWithUser({ isOwner: false, role: 'owner' })), true);
  assert.equal(userCanOverridePricing(reqWithUser({ isOwner: false, role: 'user' })), false);
});

test('commercial lock guard: blocks write after Sent unless overridePricing + privileged', () => {
  // Unlocked statuses: should pass
  assert.doesNotThrow(() =>
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: 'Draft',
      overridePricing: false,
      req: reqWithUser({ role: 'user' })
    })
  );

  // Locked status with no override: should throw
  assert.throws(
    () =>
      assertQuoteCommerciallyEditableForLineWrite({
        quoteStatus: 'Sent',
        overridePricing: false,
        req: reqWithUser({ role: 'admin' })
      }),
    (e) => e && e.code === 'QUOTE_COMMERCIALLY_LOCKED'
  );

  // Locked status with override but unprivileged: should throw
  assert.throws(
    () =>
      assertQuoteCommerciallyEditableForLineWrite({
        quoteStatus: 'Accepted',
        overridePricing: true,
        req: reqWithUser({ role: 'user' })
      }),
    (e) => e && e.code === 'QUOTE_COMMERCIALLY_LOCKED'
  );

  // Locked status with override + admin: should pass
  assert.doesNotThrow(() =>
    assertQuoteCommerciallyEditableForLineWrite({
      quoteStatus: 'Viewed',
      overridePricing: true,
      req: reqWithUser({ role: 'admin' })
    })
  );
});

test('sellability guard: only Active lifecycle is sellable', () => {
  assert.doesNotThrow(() => assertVariantSellable('Active'));
  assert.throws(() => assertVariantSellable('Draft'), (e) => e && e.code === 'VARIANT_NOT_SELLABLE');
  assert.throws(() => assertVariantSellable('Discontinued'), (e) => e && e.code === 'VARIANT_NOT_SELLABLE');
  assert.throws(() => assertVariantSellable('Archived'), (e) => e && e.code === 'VARIANT_NOT_SELLABLE');
});

test('computeDiscountAmount: caps at subtotal and supports percent', () => {
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountAmount: 15 }), 15);
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountAmount: 999 }), 100);
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountType: 'percent', discountValue: 10 }), 10);
  assert.equal(computeDiscountAmount({ lineSubtotal: 100, discountType: 'amount', discountValue: 25 }), 25);
});

test('normalizeReorderOpsOrThrow: validates shape and duplicates', () => {
  assert.throws(
    () => normalizeReorderOpsOrThrow(null, { organizationId: 'o', quoteId: 'q' }),
    (e) => e && e.code === 'VALIDATION'
  );
  assert.throws(
    () => normalizeReorderOpsOrThrow([], { organizationId: 'o', quoteId: 'q' }),
    (e) => e && e.code === 'VALIDATION'
  );
  assert.throws(
    () => normalizeReorderOpsOrThrow([{ lineOrder: 1 }], { organizationId: 'o', quoteId: 'q' }),
    (e) => e && e.code === 'VALIDATION'
  );
  assert.throws(
    () => normalizeReorderOpsOrThrow([{ quoteLineId: 'a', lineOrder: 'x' }], { organizationId: 'o', quoteId: 'q' }),
    (e) => e && e.code === 'VALIDATION'
  );
  assert.throws(
    () => normalizeReorderOpsOrThrow([{ quoteLineId: 'a', lineOrder: 1 }, { quoteLineId: 'a', lineOrder: 2 }], { organizationId: 'o', quoteId: 'q' }),
    (e) => e && e.code === 'VALIDATION'
  );

  const ops = normalizeReorderOpsOrThrow([{ quoteLineId: 'a', lineOrder: 10 }], { organizationId: 'org1', quoteId: 'quote1' });
  assert.equal(Array.isArray(ops), true);
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].updateOne.filter, { organizationId: 'org1', quoteId: 'quote1', quoteLineId: 'a' });
  assert.deepEqual(ops[0].updateOne.update, { $set: { lineOrder: 10 } });
});

