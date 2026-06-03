const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeLineRemainingToInvoice,
  deriveInvoiceStatusFromLines,
  rollupInvoiceFieldsFromLines,
  DEFAULT_BILL_ON
} = require('../../services/salesOrderInvoiceAllocationService');

test('computeLineRemainingToInvoice uses fulfilled qty by default', () => {
  const line = {
    quantity: 10,
    quantityFulfilled: 6,
    quantityCancelled: 0,
    quantityInvoiced: 2
  };
  assert.equal(computeLineRemainingToInvoice(line, DEFAULT_BILL_ON), 4);
});

test('deriveInvoiceStatusFromLines: partially invoiced', () => {
  const lines = [
    { quantity: 10, quantityFulfilled: 10, quantityCancelled: 0, quantityInvoiced: 5, hiddenLine: false },
    { quantity: 5, quantityFulfilled: 5, quantityCancelled: 0, quantityInvoiced: 5, hiddenLine: false }
  ];
  assert.equal(deriveInvoiceStatusFromLines(lines), 'partially_invoiced');
});

test('deriveInvoiceStatusFromLines: fully invoiced', () => {
  const lines = [
    { quantity: 10, quantityFulfilled: 10, quantityCancelled: 0, quantityInvoiced: 10, hiddenLine: false }
  ];
  assert.equal(deriveInvoiceStatusFromLines(lines), 'fully_invoiced');
});

test('rollupInvoiceFieldsFromLines computes invoiced amount', () => {
  const lines = [
    { quantity: 10, quantityFulfilled: 10, quantityCancelled: 0, quantityInvoiced: 5, lineTotal: 100, hiddenLine: false }
  ];
  const rollup = rollupInvoiceFieldsFromLines(lines, 200);
  assert.equal(rollup.invoiceStatus, 'partially_invoiced');
  assert.equal(rollup.invoicedAmount, 50);
  assert.equal(rollup.remainingBillableAmount, 150);
});
