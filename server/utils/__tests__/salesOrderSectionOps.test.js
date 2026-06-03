const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { assertValidSalesOrderSectionType } = require('../../constants/salesOrderSection');
const { SALES_ORDER_STATUS_DEFAULT } = require('../../constants/salesOrderLifecycle');

describe('assertValidSalesOrderSectionType', () => {
  it('accepts standard section types', () => {
    assert.equal(assertValidSalesOrderSectionType('standard'), 'standard');
    assert.equal(assertValidSalesOrderSectionType('optional'), 'optional');
  });

  it('rejects unknown types', () => {
    assert.throws(() => assertValidSalesOrderSectionType('invalid'), /Invalid section type/);
  });
});

describe('sales order section draft contract', () => {
  it('defaults manual create status to Draft', () => {
    assert.equal(SALES_ORDER_STATUS_DEFAULT, 'Draft');
  });
});
