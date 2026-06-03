/**
 * PAY3 — Online payment gateway lifecycle constants.
 */

const PAYMENT_GATEWAY_PROVIDERS = ['stripe', 'razorpay', 'manual'];

const PAYMENT_GATEWAY_PROVIDER_DEFAULT = 'stripe';

const PAYMENT_LINK_STATUSES = ['active', 'expired', 'consumed', 'revoked'];

const PAYMENT_LINK_STATUS_DEFAULT = 'active';

const PAYMENT_LINK_PAY_TARGET_TYPES = [
  'single_invoice',
  'multi_invoice',
  'open_balance',
  'fixed_amount'
];

const PAYMENT_GATEWAY_SESSION_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'canceled',
  'expired'
];

const PAYMENT_GATEWAY_SESSION_STATUS_DEFAULT = 'pending';

const PAYMENT_GATEWAY_EVENT_PROCESSING_STATUSES = [
  'received',
  'processing',
  'processed',
  'ignored',
  'failed'
];

const PAYMENT_GATEWAY_EVENT_PROCESSING_DEFAULT = 'received';

const GATEWAY_CREDENTIAL_HEALTH_STATUSES = ['unknown', 'healthy', 'degraded', 'invalid'];

const GATEWAY_CREDENTIAL_HEALTH_DEFAULT = 'unknown';

const STRIPE_CAPTURE_SUCCESS_EVENTS = [
  'checkout.session.completed',
  'payment_intent.succeeded'
];

const STRIPE_CAPTURE_FAILURE_EVENTS = ['payment_intent.payment_failed'];

const STRIPE_REFUND_EVENTS = ['charge.refunded'];

const RAZORPAY_CAPTURE_SUCCESS_EVENTS = ['payment.captured', 'order.paid'];

const RAZORPAY_CAPTURE_FAILURE_EVENTS = ['payment.failed'];

const RAZORPAY_REFUND_EVENTS = ['refund.processed'];

const BANK_TRANSFER_INSTRUCTION_STATUSES = [
  'pending',
  'proof_submitted',
  'matched',
  'expired',
  'canceled'
];

const BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT = 'pending';

function generateReferenceCode(prefix = 'BT') {
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
  return `${prefix}-${s()}${s()}`;
}

function generatePublicToken() {
  const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s()}${s()}${s()}${s()}`;
}

function isPaymentLinkActive(link, now = new Date()) {
  if (!link) return false;
  if (link.status !== 'active') return false;
  if (link.expiresAt && new Date(link.expiresAt) < now) return false;
  if (link.maxUses != null && Number(link.useCount || 0) >= Number(link.maxUses)) return false;
  return true;
}

module.exports = {
  PAYMENT_GATEWAY_PROVIDERS,
  PAYMENT_GATEWAY_PROVIDER_DEFAULT,
  PAYMENT_LINK_STATUSES,
  PAYMENT_LINK_STATUS_DEFAULT,
  PAYMENT_LINK_PAY_TARGET_TYPES,
  PAYMENT_GATEWAY_SESSION_STATUSES,
  PAYMENT_GATEWAY_SESSION_STATUS_DEFAULT,
  PAYMENT_GATEWAY_EVENT_PROCESSING_STATUSES,
  PAYMENT_GATEWAY_EVENT_PROCESSING_DEFAULT,
  GATEWAY_CREDENTIAL_HEALTH_STATUSES,
  GATEWAY_CREDENTIAL_HEALTH_DEFAULT,
  STRIPE_CAPTURE_SUCCESS_EVENTS,
  STRIPE_CAPTURE_FAILURE_EVENTS,
  STRIPE_REFUND_EVENTS,
  RAZORPAY_CAPTURE_SUCCESS_EVENTS,
  RAZORPAY_CAPTURE_FAILURE_EVENTS,
  RAZORPAY_REFUND_EVENTS,
  BANK_TRANSFER_INSTRUCTION_STATUSES,
  BANK_TRANSFER_INSTRUCTION_STATUS_DEFAULT,
  generatePublicToken,
  generateReferenceCode,
  isPaymentLinkActive
};
