'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { handleProcessWebhook } = require('../controllers/processWebhookController');

const router = express.Router();

const processWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.PROCESS_WEBHOOK_RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `process-webhook:${req.params.webhookKey || req.ip}`,
  message: { success: false, message: 'Too many webhook requests' },
  skip: () => process.env.NODE_ENV !== 'production' && process.env.SECURITY_DISABLED === 'true'
});

const captureRawBody = express.json({
  limit: '256kb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

router.post('/:webhookKey', processWebhookLimiter, captureRawBody, handleProcessWebhook);

module.exports = router;
