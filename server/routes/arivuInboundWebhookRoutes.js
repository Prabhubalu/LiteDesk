'use strict';

/**
 * Arivu Inbound Parser webhooks — mounted before express.json for HMAC raw body.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/arivuInboundWebhookController');

const rawJson = express.raw({ type: 'application/json', limit: '1mb' });

router.get('/inbound-email/health', controller.webhookHealth);
router.post('/inbound-email', rawJson, controller.handleInboundEmail);

module.exports = router;
