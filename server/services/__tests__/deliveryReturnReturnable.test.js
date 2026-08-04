/**
 * Delivery return returnable quantity math (unit).
 */
const assert = require('assert');
const {
  returnableQtyFromDnLine
} = require('../deliveryReturnService');

{
  assert.strictEqual(
    returnableQtyFromDnLine({ quantityDelivered: 20, quantityReturned: 5 }),
    15
  );
  assert.strictEqual(
    returnableQtyFromDnLine({ quantityDelivered: 10, quantityReturned: 10 }),
    0
  );
  assert.strictEqual(
    returnableQtyFromDnLine({ quantityDelivered: 5, quantityReturned: 8 }),
    0
  );
  assert.strictEqual(returnableQtyFromDnLine({}), 0);
}

function assertQtyAllowed(qty, returnable) {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('quantityReturned must be > 0');
  if (qty > returnable) throw new Error('Cannot return more than available delivered quantity');
  return true;
}

{
  assert.strictEqual(assertQtyAllowed(15, 15), true);
  let threw = false;
  try {
    assertQtyAllowed(16, 15);
  } catch {
    threw = true;
  }
  assert.strictEqual(threw, true);
}

console.log('deliveryReturnReturnable.test.js: ok');
