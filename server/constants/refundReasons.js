const REFUND_REASONS = [
  'customer_request',
  'duplicate_payment',
  'overpayment',
  'credit_note_settlement',
  'billing_error',
  'service_cancellation',
  'chargeback_resolution',
  'other'
];

function assertValidRefundReason(value) {
  const reason = String(value || '').trim();
  if (!reason) {
    const err = new Error('refund reason is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!REFUND_REASONS.includes(reason)) {
    const err = new Error(`Invalid refund reason: ${reason}`);
    err.code = 'VALIDATION';
    err.details = { reason, allowed: REFUND_REASONS };
    throw err;
  }
  return reason;
}

module.exports = {
  REFUND_REASONS,
  assertValidRefundReason
};
