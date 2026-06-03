const express = require('express');
const { stripeWebhookHandler, razorpayWebhookHandler } = require('../controllers/paymentGatewayController');

const router = express.Router();

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  razorpayWebhookHandler
);

module.exports = router;
