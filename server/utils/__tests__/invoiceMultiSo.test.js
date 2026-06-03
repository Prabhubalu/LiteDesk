const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertCompatibleSalesOrders,
  normalizeSalesOrderIds
} = require('../../services/invoiceMultiSoConversionService');

test('normalizeSalesOrderIds dedupes ids', () => {
  assert.deepEqual(normalizeSalesOrderIds(['a', 'a', ' b ', '']), ['a', 'b']);
});

test('assertCompatibleSalesOrders requires at least two orders', () => {
  assert.throws(
    () => assertCompatibleSalesOrders([{ status: 'Open', currency: 'USD' }]),
    (err) => err.code === 'VALIDATION'
  );
});

test('assertCompatibleSalesOrders rejects mixed currency', () => {
  assert.throws(
    () =>
      assertCompatibleSalesOrders([
        {
          status: 'Open',
          currency: 'USD',
          organizationRefId: 'org1',
          contactId: 'c1'
        },
        {
          status: 'Open',
          currency: 'EUR',
          organizationRefId: 'org1',
          contactId: 'c1'
        }
      ]),
    (err) => err.code === 'INCOMPATIBLE_SALES_ORDERS'
  );
});

test('assertCompatibleSalesOrders accepts matching customer context', () => {
  assert.doesNotThrow(() =>
    assertCompatibleSalesOrders([
      { status: 'Open', currency: 'USD', organizationRefId: 'org1', contactId: 'c1' },
      { status: 'Partially Fulfilled', currency: 'USD', organizationRefId: 'org1', contactId: 'c1' }
    ])
  );
});
