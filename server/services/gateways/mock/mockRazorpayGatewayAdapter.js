/**
 * PAY3.2 — Mock Razorpay adapter for tests and local dev without API keys.
 */

const crypto = require('crypto');
const {
  RAZORPAY_CAPTURE_SUCCESS_EVENTS,
  RAZORPAY_CAPTURE_FAILURE_EVENTS
} = require('../../../constants/paymentGatewayLifecycle');

const MOCK_SIGNATURE_HEADER = 'x-mock-razorpay-signature';
const MOCK_VALID_SIGNATURE = 'mock_razorpay_valid';

function getMockRazorpayStore() {
  if (!global.__mockRazorpayStore) {
    global.__mockRazorpayStore = { orders: new Map(), events: new Map() };
  }
  return global.__mockRazorpayStore;
}

function resetMockRazorpayStore() {
  global.__mockRazorpayStore = { orders: new Map(), events: new Map() };
}

async function verifyCredentials() {
  return { status: 'healthy' };
}

async function createCheckoutSession({
  organizationId,
  amount,
  currency,
  successUrl,
  cancelUrl,
  metadata = {}
}) {
  const store = getMockRazorpayStore();
  const providerSessionId = `order_mock_${crypto.randomUUID().replace(/-/g, '')}`;
  const checkoutUrl = `https://checkout.mock.razorpay/${providerSessionId}`;

  store.orders.set(providerSessionId, {
    organizationId: String(organizationId),
    amount,
    currency,
    metadata,
    successUrl,
    cancelUrl,
    status: 'created'
  });

  return {
    providerSessionId,
    checkoutUrl,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    razorpayKeyId: 'rzp_mock_key',
    razorpayOrderId: providerSessionId,
    amountMinor: Math.round(Number(amount) * 100),
    currency: String(currency || 'INR').toUpperCase()
  };
}

function verifyWebhookSignature(rawBody, headers = {}) {
  const signature = headers[MOCK_SIGNATURE_HEADER] || headers['X-Mock-Razorpay-Signature'];
  return signature === MOCK_VALID_SIGNATURE;
}

function parseWebhookEvent(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const providerEventId = body.id || `evt_rzp_mock_${crypto.randomUUID()}`;
  const paymentEntity = body.payload?.payment?.entity || {};
  const notes = paymentEntity.notes || body.payload?.order?.entity?.notes || {};

  getMockRazorpayStore().events.set(providerEventId, body);

  return {
    providerEventId,
    eventType: body.event,
    providerSessionId: paymentEntity.order_id || body.payload?.order?.entity?.id || null,
    providerPaymentId: paymentEntity.id || `pay_mock_${providerEventId.replace('evt_', '')}`,
    amount: paymentEntity.amount != null ? Number(paymentEntity.amount) / 100 : null,
    currency: String(paymentEntity.currency || 'inr').toUpperCase(),
    status: body.event && RAZORPAY_CAPTURE_FAILURE_EVENTS.includes(body.event) ? 'failed' : 'succeeded',
    organizationId: notes.organizationId || null,
    paymentGatewaySessionId: notes.paymentGatewaySessionId || null,
    paymentLinkId: notes.paymentLinkId || null,
    raw: body
  };
}

function buildInstrumentSnapshot(parsedEvent) {
  return {
    method: 'other',
    referenceNumber: parsedEvent.providerPaymentId,
    bankName: null,
    maskedAccount: 'mock••••upi',
    provider: 'razorpay'
  };
}

function isCaptureSuccessEvent(eventType) {
  return RAZORPAY_CAPTURE_SUCCESS_EVENTS.includes(eventType);
}

function isCaptureFailureEvent(eventType) {
  return RAZORPAY_CAPTURE_FAILURE_EVENTS.includes(eventType);
}

function buildMockSuccessWebhook({
  organizationId,
  paymentGatewaySessionId,
  paymentLinkId,
  providerSessionId,
  providerPaymentId,
  amount,
  currency = 'INR'
}) {
  const providerEventId = `evt_rzp_mock_${crypto.randomUUID().replace(/-/g, '')}`;
  return {
    id: providerEventId,
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: providerPaymentId || `pay_mock_${Date.now()}`,
          order_id: providerSessionId,
          amount: Math.round(Number(amount) * 100),
          currency: String(currency).toLowerCase(),
          method: 'upi',
          notes: {
            organizationId: String(organizationId),
            paymentGatewaySessionId,
            paymentLinkId: paymentLinkId || ''
          }
        }
      }
    }
  };
}

function buildMockFailureWebhook({
  organizationId,
  paymentGatewaySessionId,
  providerSessionId
}) {
  return {
    id: `evt_rzp_fail_${Date.now()}`,
    event: 'payment.failed',
    payload: {
      payment: {
        entity: {
          id: `pay_fail_${Date.now()}`,
          order_id: providerSessionId,
          notes: {
            organizationId: String(organizationId),
            paymentGatewaySessionId
          }
        }
      }
    }
  };
}

module.exports = {
  providerKey: 'razorpay',
  MOCK_SIGNATURE_HEADER,
  MOCK_VALID_SIGNATURE,
  resetMockRazorpayStore,
  verifyCredentials,
  createCheckoutSession,
  verifyWebhookSignature,
  parseWebhookEvent,
  buildInstrumentSnapshot,
  isCaptureSuccessEvent,
  isCaptureFailureEvent,
  buildMockSuccessWebhook,
  buildMockFailureWebhook
};
