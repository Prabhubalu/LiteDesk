/**
 * PAY3 — Gateway adapter registry.
 */

const stripeGatewayAdapter = require('./stripe/stripeGatewayAdapter');
const mockStripeGatewayAdapter = require('./mock/mockStripeGatewayAdapter');
const razorpayGatewayAdapter = require('./razorpay/razorpayGatewayAdapter');
const mockRazorpayGatewayAdapter = require('./mock/mockRazorpayGatewayAdapter');

function useMockStripeAdapter() {
  return (
    process.env.PAYMENT_GATEWAY_USE_MOCK === '1' ||
    process.env.NODE_ENV === 'test' ||
    !process.env.STRIPE_SECRET_KEY
  );
}

function useMockRazorpayAdapter() {
  return (
    process.env.PAYMENT_GATEWAY_USE_MOCK === '1' ||
    process.env.NODE_ENV === 'test' ||
    (!process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_SECRET)
  );
}

function getGatewayAdapter(provider = 'stripe') {
  if (provider === 'stripe') {
    return useMockStripeAdapter() ? mockStripeGatewayAdapter : stripeGatewayAdapter;
  }

  if (provider === 'razorpay') {
    return useMockRazorpayAdapter() ? mockRazorpayGatewayAdapter : razorpayGatewayAdapter;
  }

  const err = new Error(`Gateway provider "${provider}" is not enabled`);
  err.code = 'GATEWAY_NOT_ENABLED';
  throw err;
}

module.exports = {
  useMockStripeAdapter,
  useMockRazorpayAdapter,
  getGatewayAdapter,
  mockStripeGatewayAdapter,
  mockRazorpayGatewayAdapter,
  stripeGatewayAdapter,
  razorpayGatewayAdapter
};
