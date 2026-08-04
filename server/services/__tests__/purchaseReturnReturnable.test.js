/**
 * Purchase return returnable quantity math (unit).
 */
const assert = require('assert');

function returnableQtyFromRnLine(rnLine) {
  return Math.max(0, Number(rnLine.quantityAccepted || 0) - Number(rnLine.quantityReturned || 0));
}

{
  assert.strictEqual(
    returnableQtyFromRnLine({ quantityAccepted: 20, quantityReturned: 5 }),
    15
  );
  assert.strictEqual(
    returnableQtyFromRnLine({ quantityAccepted: 10, quantityReturned: 10 }),
    0
  );
  assert.strictEqual(
    returnableQtyFromRnLine({ quantityAccepted: 5, quantityReturned: 8 }),
    0
  );
  assert.strictEqual(returnableQtyFromRnLine({}), 0);
}

function assertQtyAllowed(qty, returnable) {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('quantityReturned must be > 0');
  if (qty > returnable) throw new Error('Cannot return more than available received quantity');
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

console.log('purchaseReturnReturnable.test.js: ok');
