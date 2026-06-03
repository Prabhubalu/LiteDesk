const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SALES_ORDER_STATUSES,
  SALES_ORDER_STATUS_DEFAULT,
  SALES_ORDER_STATUS_ON_QUOTE_CONVERT,
  canTransitionSalesOrderStatus,
  isSalesOrderCommerciallyLockedStatus
} = require('../../constants/salesOrderLifecycle');

const {
  assertValidFulfillmentMode,
  deriveLineFulfillmentStatus,
  deriveHeaderFulfillmentStatus
} = require('../../constants/salesOrderFulfillment');

test('sales order lifecycle defaults', () => {
  assert.equal(SALES_ORDER_STATUS_DEFAULT, 'Draft');
  assert.equal(SALES_ORDER_STATUS_ON_QUOTE_CONVERT, 'Confirmed');
  assert.ok(SALES_ORDER_STATUSES.includes('Confirmed'));
});

test('quote convert lands SO in Confirmed', () => {
  assert.equal(SALES_ORDER_STATUS_ON_QUOTE_CONVERT, 'Confirmed');
});

test('sales order transitions: Draft to Confirmed', () => {
  assert.equal(canTransitionSalesOrderStatus('Draft', 'Confirmed'), true);
});

test('sales order commercial lock at Confirmed', () => {
  assert.equal(isSalesOrderCommerciallyLockedStatus('Confirmed'), true);
  assert.equal(isSalesOrderCommerciallyLockedStatus('Draft'), false);
});

test('fulfillmentMode validation', () => {
  assert.equal(assertValidFulfillmentMode('product'), 'product');
  assert.equal(assertValidFulfillmentMode('service'), 'service');
  assert.equal(assertValidFulfillmentMode('hybrid'), 'hybrid');
  assert.throws(() => assertValidFulfillmentMode('ship-only'));
});

test('deriveLineFulfillmentStatus: service-friendly In Progress', () => {
  const line = { quantity: 1, quantityFulfilled: 0, fulfillmentStatus: 'In Progress' };
  assert.equal(deriveLineFulfillmentStatus(line), 'In Progress');
});

test('deriveLineFulfillmentStatus: partial qty', () => {
  const line = { quantity: 10, quantityFulfilled: 3, quantityCancelled: 0 };
  assert.equal(deriveLineFulfillmentStatus(line), 'Partially Fulfilled');
});

test('deriveHeaderFulfillmentStatus rollup', () => {
  const lines = [
    { quantity: 1, quantityFulfilled: 1 },
    { quantity: 2, quantityFulfilled: 0, fulfillmentStatus: 'In Progress' }
  ];
  assert.equal(deriveHeaderFulfillmentStatus(lines), 'Partially Fulfilled');
});
