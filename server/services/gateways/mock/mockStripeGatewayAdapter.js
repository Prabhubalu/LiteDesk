/**
 * PAY3 — Mock Stripe adapter for tests and local dev without API keys.
 */

const crypto = require('crypto');
const {
  STRIPE_CAPTURE_SUCCESS_EVENTS,
  STRIPE_CAPTURE_FAILURE_EVENTS
} = require('../../../constants/paymentGatewayLifecycle');

const MOCK_SIGNATURE_HEADER = 'x-mock-stripe-signature';
const MOCK_VALID_SIGNATURE = 'mock_valid';

function getMockStripe() {
  if (!global.__mockStripeStore) {
    global.__mockStripeStore = {
      sessions: new Map(),
      events: new Map()
    };
  }
  return global.__mockStripeStore;
}

function resetMockStripeStore() {
  global.__mockStripeStore = { sessions: new Map(), events: new Map() };
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
  const store = getMockStripe();
  const providerSessionId = `cs_mock_${crypto.randomUUID().replace(/-/g, '')}`;
  const checkoutUrl = `https://checkout.mock.stripe/${providerSessionId}`;

  store.sessions.set(providerSessionId, {
    organizationId: String(organizationId),
    amount,
    currency,
    metadata,
    successUrl,
    cancelUrl,
    status: 'open'
  });

  return {
    providerSessionId,
    checkoutUrl,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
  };
}

function verifyWebhookSignature(rawBody, headers = {}) {
  const signature = headers[MOCK_SIGNATURE_HEADER] || headers['X-Mock-Stripe-Signature'];
  return signature === MOCK_VALID_SIGNATURE;
}

function parseWebhookEvent(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const providerEventId = body.id || `evt_mock_${crypto.randomUUID()}`;
  const eventType = body.type;
  const dataObject = body.data?.object || {};

  getMockStripe().events.set(providerEventId, body);

  return {
    providerEventId,
    eventType,
    providerSessionId: dataObject.id?.startsWith('cs_')
      ? dataObject.id
      : dataObject.metadata?.providerSessionId || dataObject.client_reference_id || null,
    providerPaymentId: dataObject.payment_intent || dataObject.id?.startsWith('pi_')
      ? dataObject.payment_intent || dataObject.id
      : `pi_mock_${providerEventId.replace('evt_', '')}`,
    amount: dataObject.amount_total != null
      ? Number(dataObject.amount_total) / 100
      : Number(dataObject.amount || 0) / 100,
    currency: String(dataObject.currency || 'usd').toUpperCase(),
    status: eventType && STRIPE_CAPTURE_FAILURE_EVENTS.includes(eventType) ? 'failed' : 'succeeded',
    organizationId: dataObject.metadata?.organizationId || body.metadata?.organizationId || null,
    paymentGatewaySessionId: dataObject.metadata?.paymentGatewaySessionId || null,
    paymentLinkId: dataObject.metadata?.paymentLinkId || null,
    raw: body
  };
}

function buildInstrumentSnapshot(parsedEvent) {
  return {
    method: 'card',
    referenceNumber: parsedEvent.providerPaymentId,
    bankName: null,
    maskedAccount: 'mock••••4242',
    provider: 'stripe'
  };
}

function isCaptureSuccessEvent(eventType) {
  return STRIPE_CAPTURE_SUCCESS_EVENTS.includes(eventType);
}

function isCaptureFailureEvent(eventType) {
  return STRIPE_CAPTURE_FAILURE_EVENTS.includes(eventType);
}

function buildMockSuccessWebhook({
  organizationId,
  paymentGatewaySessionId,
  paymentLinkId,
  providerSessionId,
  providerPaymentId,
  amount,
  currency = 'USD'
}) {
  const providerEventId = `evt_mock_${crypto.randomUUID().replace(/-/g, '')}`;
  return {
    id: providerEventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: providerSessionId,
        payment_intent: providerPaymentId || `pi_mock_${Date.now()}`,
        amount_total: Math.round(Number(amount) * 100),
        currency: String(currency).toLowerCase(),
        metadata: {
          organizationId: String(organizationId),
          paymentGatewaySessionId,
          paymentLinkId: paymentLinkId || '',
          providerSessionId
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
    id: `evt_mock_fail_${Date.now()}`,
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: providerSessionId,
        metadata: {
          organizationId: String(organizationId),
          paymentGatewaySessionId
        }
      }
    }
  };
}

module.exports = {
  providerKey: 'stripe',
  MOCK_SIGNATURE_HEADER,
  MOCK_VALID_SIGNATURE,
  resetMockStripeStore,
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
