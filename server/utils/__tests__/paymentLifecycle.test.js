const test = require('node:test');
const assert = require('node:assert/strict');

const {
  derivePaymentStatus,
  deriveInvoicePaymentStatus,
  deriveInvoiceLifecycleStatusFromPayment,
  defaultAutoApplyForPurpose,
  assertValidPaymentPurpose,
  roundMoney
} = require('../../constants/paymentLifecycle');

test('derivePaymentStatus: recorded when unallocated', () => {
  assert.equal(
    derivePaymentStatus({ amount: 100, amountAllocated: 0, amountRefunded: 0 }),
    'recorded'
  );
});

test('derivePaymentStatus: fully_allocated', () => {
  assert.equal(
    derivePaymentStatus({ amount: 100, amountAllocated: 100, amountRefunded: 0 }),
    'fully_allocated'
  );
});

test('deriveInvoicePaymentStatus: unpaid', () => {
  assert.equal(
    deriveInvoicePaymentStatus({ grandTotal: 500, amountPaid: 0, amountDue: 500, writeOffTotal: 0 }),
    'unpaid'
  );
});

test('deriveInvoicePaymentStatus: paid', () => {
  assert.equal(
    deriveInvoicePaymentStatus({ grandTotal: 500, amountPaid: 500, amountDue: 0, writeOffTotal: 0 }),
    'paid'
  );
});

test('deriveInvoiceLifecycleStatusFromPayment: Partially Paid', () => {
  assert.equal(
    deriveInvoiceLifecycleStatusFromPayment({
      status: 'Posted',
      grandTotal: 500,
      amountPaid: 200,
      amountDue: 300,
      writeOffTotal: 0
    }),
    'Partially Paid'
  );
});

test('deriveInvoiceLifecycleStatusFromPayment: Paid', () => {
  assert.equal(
    deriveInvoiceLifecycleStatusFromPayment({
      status: 'Partially Paid',
      grandTotal: 500,
      amountPaid: 500,
      amountDue: 0,
      writeOffTotal: 0
    }),
    'Paid'
  );
});

test('defaultAutoApplyForPurpose only for invoice_payment', () => {
  assert.equal(defaultAutoApplyForPurpose('invoice_payment'), true);
  assert.equal(defaultAutoApplyForPurpose('deposit'), false);
  assert.equal(defaultAutoApplyForPurpose('retainer'), false);
});

test('assertValidPaymentPurpose rejects invalid', () => {
  assert.throws(() => assertValidPaymentPurpose('invalid'), (err) => err.code === 'VALIDATION');
});

test('roundMoney rounds to 2 decimals', () => {
  assert.equal(roundMoney(10.005), 10.01);
});
