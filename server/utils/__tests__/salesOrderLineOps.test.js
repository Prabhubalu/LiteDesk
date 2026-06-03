const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyQuantityDeltaToLine,
  reverseQuantityDeltaOnLine,
  resolveOrderStatusAfterReversal,
  resolveReversalActivityAction
} = require('../../services/salesOrderFulfillmentService');
const salesOrderTotalsService = require('../../services/salesOrderTotalsService');

describe('reverseQuantityDeltaOnLine: ship rollback', () => {
  it('subtracts fulfilled qty', () => {
    const line = {
      salesOrderLineId: 'l1',
      quantity: 10,
      quantityFulfilled: 5,
      quantityCancelled: 0,
      quantityBackordered: 0
    };
    const row = reverseQuantityDeltaOnLine(line, 'ship', 3);
    assert.equal(line.quantityFulfilled, 2);
    assert.equal(row.newQuantityFulfilled, 2);
    assert.equal(line.fulfillmentStatus, 'Partially Fulfilled');
  });
});

describe('reverseQuantityDeltaOnLine: rejects over-reverse', () => {
  it('throws when delta exceeds fulfilled', () => {
    const line = { salesOrderLineId: 'l1', quantity: 5, quantityFulfilled: 2, quantityCancelled: 0 };
    assert.throws(() => reverseQuantityDeltaOnLine(line, 'ship', 3), /exceeds fulfilled/);
  });
});

describe('resolveOrderStatusAfterReversal', () => {
  it('returns Confirmed when nothing fulfilled', () => {
    const lines = [{ quantity: 5, quantityFulfilled: 0, quantityCancelled: 0 }];
    assert.equal(resolveOrderStatusAfterReversal('Partially Fulfilled', lines), 'Confirmed');
  });
});

describe('resolveReversalActivityAction', () => {
  it('maps ship and deliver', () => {
    assert.equal(resolveReversalActivityAction('ship'), 'shipment_reversed');
    assert.equal(resolveReversalActivityAction('deliver'), 'delivery_reversed');
    assert.equal(resolveReversalActivityAction('cancel'), 'fulfillment_reversed');
  });
});

describe('apply + reverse round trip', () => {
  it('restores open qty', () => {
    const line = {
      salesOrderLineId: 'l1',
      quantity: 8,
      quantityFulfilled: 0,
      quantityCancelled: 0,
      quantityBackordered: 0
    };
    applyQuantityDeltaToLine(line, 'ship', 4);
    assert.equal(line.quantityFulfilled, 4);
    reverseQuantityDeltaOnLine(line, 'ship', 4);
    assert.equal(line.quantityFulfilled, 0);
  });
});

describe('salesOrderTotalsService after qty change', () => {
  it('recomputes line totals', () => {
    const line = { quantity: 4, unitPriceSnapshot: 10, discountType: null, discountValue: 0, discountAmount: 0 };
    const computed = salesOrderTotalsService.computeLineTotals(line);
    assert.equal(computed.lineTotal, 40);
  });
});
