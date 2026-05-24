/**
 * ============================================================================
 * Email Webhook Routes (Phase 2 + Phase 4)
 * ============================================================================
 *
 * POST /api/webhooks/email/inbound
 * - No JWT auth; optional shared secret EMAIL_INBOUND_WEBHOOK_SECRET (Bearer or X-Email-Inbound-Webhook-Token).
 * - Tenant routing continues to use reply-To token verification inside the MIME.
 * - Accepts raw MIME (Content-Type: message/rfc822) or JSON { rawMime: "<base64>" }
 *
 * POST /api/webhooks/email/ses-events
 * - No auth middleware (SNS posts from AWS)
 * - Accepts SNS Notification (SES delivery/bounce/complaint)
 *
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const inboundController = require('../controllers/inboundEmailController');
const sesWebhookController = require('../controllers/sesWebhookController');
const emailEventWebhookController = require('../controllers/emailEventWebhookController');
const gmailPushWebhookController = require('../controllers/gmailPushWebhookController');
const { isGmailIntegrationEnabled } = require('../config/emailFeatureFlags');
const {
  requireLegacyMimeInboundWebhook
} = require('../middleware/emailIntegrationMiddleware');

// For message/rfc822: parse raw body. For application/json: body already parsed by app-level middleware
const rawParser = express.raw({ type: ['message/rfc822', 'text/plain'], limit: '10mb' });

router.get('/inbound/health', inboundController.inboundHealth);

router.post(
  '/inbound',
  requireLegacyMimeInboundWebhook,
  (req, res, next) => {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('message/rfc822') || ct.includes('text/plain')) {
      return rawParser(req, res, (err) => (err ? next(err) : next()));
    }
    next();
  },
  inboundController.handleInbound
);

router.post('/ses-events', sesWebhookController.handleSesEvents);
router.post('/events', emailEventWebhookController.handleProviderEvents);

// Gmail Pub/Sub push (R3.1) — disabled unless ENABLE_GMAIL_INTEGRATION=true
if (isGmailIntegrationEnabled()) {
  router.get('/gmail/push', gmailPushWebhookController.verifyGmailPushSubscription);
  router.post('/gmail/push', gmailPushWebhookController.handleGmailPush);
}

module.exports = router;
