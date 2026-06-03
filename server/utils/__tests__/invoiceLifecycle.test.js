const test = require('node:test');
const assert = require('node:assert/strict');

const {
  INVOICE_STATUSES,
  INVOICE_STATUS_DEFAULT,
  INVOICE_RESERVED_STATUSES,
  canTransitionInvoiceStatus,
  isInvoiceCommerciallyLockedStatus,
  assertInvoiceCommercialEditAllowed,
  assertCanTransitionInvoiceStatus
} = require('../../constants/invoiceLifecycle');

test('invoice lifecycle defaults', () => {
  assert.equal(INVOICE_STATUS_DEFAULT, 'Draft');
  assert.ok(INVOICE_STATUSES.includes('Posted'));
  assert.ok(INVOICE_STATUSES.includes('Partially Posted'));
});

test('Partially Posted is reserved — no transitions', () => {
  assert.ok(INVOICE_RESERVED_STATUSES.includes('Partially Posted'));
  assert.equal(canTransitionInvoiceStatus('Posted', 'Partially Posted'), false);
  assert.throws(() => assertCanTransitionInvoiceStatus('Posted', 'Partially Posted'));
});

test('invoice transitions: Draft to Posted', () => {
  assert.equal(canTransitionInvoiceStatus('Draft', 'Posted'), true);
});

test('invoice commercial lock at Posted', () => {
  assert.equal(isInvoiceCommerciallyLockedStatus('Posted'), true);
  assert.equal(isInvoiceCommerciallyLockedStatus('Draft'), false);
});

test('assertInvoiceCommercialEditAllowed blocks Posted edits', () => {
  assert.throws(() => assertInvoiceCommercialEditAllowed({ status: 'Posted' }), (err) => {
    return err.code === 'INVOICE_COMMERCIAL_LOCK';
  });
});
