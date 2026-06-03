const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canTransitionInvoiceStatus,
  assertCanTransitionInvoiceStatus
} = require('../../constants/invoiceLifecycle');

test('invoice approval workflow transitions', () => {
  assert.equal(canTransitionInvoiceStatus('Draft', 'Pending Approval'), true);
  assert.equal(canTransitionInvoiceStatus('Pending Approval', 'Approved'), true);
  assert.equal(canTransitionInvoiceStatus('Pending Approval', 'Draft'), true);
  assert.doesNotThrow(() => assertCanTransitionInvoiceStatus('Draft', 'Pending Approval'));
  assert.doesNotThrow(() => assertCanTransitionInvoiceStatus('Pending Approval', 'Approved'));
});
