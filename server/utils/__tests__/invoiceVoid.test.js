const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canTransitionInvoiceStatus,
  assertCanTransitionInvoiceStatus
} = require('../../constants/invoiceLifecycle');

test('invoice can transition Posted to Void', () => {
  assert.equal(canTransitionInvoiceStatus('Posted', 'Void'), true);
});

test('invoice cannot void Draft directly without path', () => {
  assert.equal(canTransitionInvoiceStatus('Draft', 'Void'), true);
});

test('assertCanTransitionInvoiceStatus allows Posted to Void', () => {
  assert.doesNotThrow(() => assertCanTransitionInvoiceStatus('Posted', 'Void'));
});
