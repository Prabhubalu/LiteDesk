/**
 * PAY3 — Stripe gateway adapter (Checkout Session).
 */

const {
  STRIPE_CAPTURE_SUCCESS_EVENTS,
  STRIPE_CAPTURE_FAILURE_EVENTS,
  STRIPE_REFUND_EVENTS
} = require('../../../constants/paymentGatewayLifecycle');

function getStripeClient(secretKey) {
  if (!secretKey) {
    const err = new Error('Stripe secret key is not configured');
    err.code = 'GATEWAY_CREDENTIALS_INVALID';
    throw err;
  }

  let Stripe;
  try {
    Stripe = require('stripe');
  } catch {
    const err = new Error('stripe package is not installed');
    err.code = 'GATEWAY_NOT_CONFIGURED';
    throw err;
  }

  return new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });
}

function resolveStripeSecret(settings = {}) {
  return (
    process.env.STRIPE_SECRET_KEY ||
    settings?.stripe?.secretKey ||
    null
  );
}

function resolveWebhookSecret(settings = {}) {
  return settings?.stripe?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || null;
}

async function verifyCredentials({ settings = {} }) {
  const secretKey = resolveStripeSecret(settings);
  if (!secretKey) {
    return { status: 'invalid', errorMessage: 'Stripe secret key missing' };
  }

  try {
    const stripe = getStripeClient(secretKey);
    if (settings?.stripe?.connectedAccountId) {
      const account = await stripe.accounts.retrieve(settings.stripe.connectedAccountId);
      if (!account.charges_enabled) {
        return { status: 'degraded', errorMessage: 'Connected account charges not enabled' };
      }
    } else {
      await stripe.balance.retrieve();
    }
    return { status: 'healthy' };
  } catch (err) {
    return { status: 'invalid', errorMessage: err.message };
  }
}

async function createCheckoutSession({
  organizationId,
  settings = {},
  amount,
  currency,
  successUrl,
  cancelUrl,
  metadata = {}
}) {
  const secretKey = resolveStripeSecret(settings);
  const stripe = getStripeClient(secretKey);

  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency: String(currency || 'USD').toLowerCase(),
          product_data: { name: metadata.productName || 'Invoice payment' },
          unit_amount: Math.round(Number(amount) * 100)
        },
        quantity: 1
      }
    ],
    metadata: {
      ...metadata,
      organizationId: String(organizationId)
    }
  };

  const requestOptions = settings?.stripe?.connectedAccountId
    ? { stripeAccount: settings.stripe.connectedAccountId }
    : undefined;

  const session = await stripe.checkout.sessions.create(params, requestOptions);

  return {
    providerSessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
  };
}

function verifyWebhookSignature(rawBody, headers = {}, settings = {}) {
  const webhookSecret = resolveWebhookSecret(settings);
  if (!webhookSecret) return false;

  try {
    const stripe = getStripeClient(resolveStripeSecret(settings));
    const signature = headers['stripe-signature'];
    stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
    return true;
  } catch {
    return false;
  }
}

function parseWebhookEvent(rawBody) {
  const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  const dataObject = body.data?.object || {};

  return {
    providerEventId: body.id,
    eventType: body.type,
    providerSessionId: dataObject.id?.startsWith('cs_') ? dataObject.id : dataObject.metadata?.providerSessionId || null,
    providerPaymentId:
      dataObject.payment_intent ||
      (dataObject.id?.startsWith('pi_') ? dataObject.id : null),
    amount:
      dataObject.amount_total != null
        ? Number(dataObject.amount_total) / 100
        : dataObject.amount != null
          ? Number(dataObject.amount) / 100
          : null,
    currency: dataObject.currency ? String(dataObject.currency).toUpperCase() : null,
    status: STRIPE_CAPTURE_FAILURE_EVENTS.includes(body.type) ? 'failed' : 'succeeded',
    organizationId: dataObject.metadata?.organizationId || null,
    paymentGatewaySessionId: dataObject.metadata?.paymentGatewaySessionId || null,
    paymentLinkId: dataObject.metadata?.paymentLinkId || null,
    raw: body
  };
}

function buildInstrumentSnapshot(parsedEvent, rawEvent = {}) {
  const charge = rawEvent?.data?.object?.payment_method_details?.card;
  return {
    method: 'card',
    referenceNumber: parsedEvent.providerPaymentId,
    bankName: null,
    maskedAccount: charge?.last4 ? `${charge.brand || 'card'}••••${charge.last4}` : null,
    provider: 'stripe'
  };
}

function isCaptureSuccessEvent(eventType) {
  return STRIPE_CAPTURE_SUCCESS_EVENTS.includes(eventType);
}

function isCaptureFailureEvent(eventType) {
  return STRIPE_CAPTURE_FAILURE_EVENTS.includes(eventType);
}

function isRefundEvent(eventType) {
  return STRIPE_REFUND_EVENTS.includes(eventType);
}

module.exports = {
  providerKey: 'stripe',
  verifyCredentials,
  createCheckoutSession,
  verifyWebhookSignature,
  parseWebhookEvent,
  buildInstrumentSnapshot,
  isCaptureSuccessEvent,
  isCaptureFailureEvent,
  isRefundEvent
};
