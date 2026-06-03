const PAYMENT_ACTIVITY_MESSAGES = {
  payment_recorded: 'Payment recorded',
  payment_allocated: 'Payment allocated',
  payment_reversal_completed: 'Payment reversal completed',
  refund_created: 'Refund created',
  refund_completed: 'Refund completed',
  customer_credit_applied: 'Customer credit applied',
  customer_credit_reversed: 'Customer credit reversed',
  customer_statement_generated: 'Customer statement generated'
};

export function getPaymentActivityMessage(event) {
  if (!event) return null;
  const action = String(event?.action || event?.payload?.action || '').trim();
  const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (msg && !PAYMENT_ACTIVITY_MESSAGES[action]) return msg;
  if (PAYMENT_ACTIVITY_MESSAGES[action]) return PAYMENT_ACTIVITY_MESSAGES[action];
  if (action === 'refund_completed') {
    const d = event?.details || event?.payload?.details || {};
    if (d.refundNumber) return `Refund ${d.refundNumber} completed`;
  }
  return null;
}
