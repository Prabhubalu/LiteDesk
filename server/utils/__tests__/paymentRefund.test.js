const test = require('node:test');
const assert = require('node:assert/strict');

const { REFUND_REASONS, assertValidRefundReason } = require('../../constants/refundReasons');
const { computeRefundableAmount } = require('../../services/refundService');

test('REFUND_REASONS includes catalog values', () => {
  assert.ok(REFUND_REASONS.includes('customer_request'));
  assert.ok(REFUND_REASONS.includes('overpayment'));
  assert.ok(REFUND_REASONS.includes('credit_note_settlement'));
  assert.ok(REFUND_REASONS.includes('chargeback_resolution'));
  assert.equal(REFUND_REASONS.length, 8);
});

test('assertValidRefundReason accepts catalog reason', () => {
  assert.equal(assertValidRefundReason('duplicate_payment'), 'duplicate_payment');
});

test('assertValidRefundReason rejects invalid reason', () => {
  assert.throws(() => assertValidRefundReason('bad_reason'), (err) => err.code === 'VALIDATION');
});

test('computeRefundableAmount subtracts amountRefunded', () => {
  assert.equal(
    computeRefundableAmount({ amount: 1000, amountRefunded: 200 }),
    800
  );
});

test('computeRefundableAmount floors at zero', () => {
  assert.equal(
    computeRefundableAmount({ amount: 100, amountRefunded: 150 }),
    0
  );
});
