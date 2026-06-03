const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyQuantityDeltaToLine,
  resolveOrderStatusAfterFulfillment,
  assertCanPostFulfillment
} = require('../../services/salesOrderFulfillmentService');
const { deriveLineFulfillmentStatus } = require('../../constants/salesOrderFulfillment');

test('applyQuantityDeltaToLine: partial ship', () => {
  const line = {
    salesOrderLineId: 'l1',
    quantity: 10,
    quantityFulfilled: 0,
    quantityCancelled: 0,
    quantityBackordered: 0
  };
  const row = applyQuantityDeltaToLine(line, 'ship', 3);
  assert.equal(row.newQuantityFulfilled, 3);
  assert.equal(line.fulfillmentStatus, 'Partially Fulfilled');
});

test('applyQuantityDeltaToLine: rejects over-fulfill', () => {
  const line = { salesOrderLineId: 'l1', quantity: 5, quantityFulfilled: 4, quantityCancelled: 0 };
  assert.throws(() => applyQuantityDeltaToLine(line, 'ship', 2), (err) => err.code === 'VALIDATION');
});

test('applyQuantityDeltaToLine: cancel remaining', () => {
  const line = {
    salesOrderLineId: 'l1',
    quantity: 4,
    quantityFulfilled: 1,
    quantityCancelled: 0,
    quantityBackordered: 0
  };
  applyQuantityDeltaToLine(line, 'cancel', 3);
  assert.equal(line.quantityCancelled, 3);
  assert.equal(deriveLineFulfillmentStatus(line), 'Fulfilled');
});

test('resolveOrderStatusAfterFulfillment: Confirmed advances on partial fulfill', () => {
  const lines = [{ quantity: 10, quantityFulfilled: 2, quantityCancelled: 0, quantityBackordered: 0 }];
  const next = resolveOrderStatusAfterFulfillment('Confirmed', lines);
  assert.ok(next === 'In Fulfillment' || next === 'Partially Fulfilled');
});

test('resolveOrderStatusAfterFulfillment: all fulfilled', () => {
  const lines = [{ quantity: 2, quantityFulfilled: 2, quantityCancelled: 0, quantityBackordered: 0 }];
  assert.equal(resolveOrderStatusAfterFulfillment('In Fulfillment', lines), 'Fulfilled');
});

test('assertCanPostFulfillment: blocks Draft', () => {
  assert.throws(() => assertCanPostFulfillment({ status: 'Draft' }), (err) => err.code === 'FULFILLMENT_NOT_ALLOWED');
});

test('assertCanPostFulfillment: allows Confirmed', () => {
  assert.doesNotThrow(() => assertCanPostFulfillment({ status: 'Confirmed' }));
});
