const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveInvoicePaymentStatus,
  deriveInvoiceLifecycleStatusFromPayment
} = require('../../constants/paymentLifecycle');

test('deriveInvoicePaymentStatus: paid via credit only', () => {
  assert.equal(
    deriveInvoicePaymentStatus({
      grandTotal: 500,
      amountPaid: 0,
      creditAppliedTotal: 500,
      writeOffTotal: 0,
      amountDue: 0
    }),
    'paid'
  );
});

test('deriveInvoiceLifecycleStatusFromPayment: Paid when credit closes invoice', () => {
  assert.equal(
    deriveInvoiceLifecycleStatusFromPayment({
      status: 'Posted',
      grandTotal: 500,
      amountPaid: 0,
      creditAppliedTotal: 500,
      amountDue: 0,
      writeOffTotal: 0
    }),
    'Paid'
  );
});

test('amountDue formula components', () => {
  const grandTotal = 1000;
  const amountPaid = 300;
  const creditAppliedTotal = 200;
  const writeOffTotal = 100;
  const amountDue = Math.max(0, grandTotal - amountPaid - creditAppliedTotal - writeOffTotal);
  assert.equal(amountDue, 400);
});
