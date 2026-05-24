'use strict';

const {
  isGmailIntegrationEnabled,
  isLegacyMimeInboundWebhookEnabled
} = require('../config/emailFeatureFlags');

function requireGmailIntegration(req, res, next) {
  if (!isGmailIntegrationEnabled()) {
    return res.status(503).json({
      success: false,
      code: 'GMAIL_INTEGRATION_DISABLED',
      message:
        'Gmail OAuth, sync, and Gmail SMTP are disabled. Use Resend/OCI for outbound and the Arivu Inbound Parser for inbound.'
    });
  }
  return next();
}

function requireLegacyMimeInboundWebhook(req, res, next) {
  if (!isLegacyMimeInboundWebhookEnabled()) {
    return res.status(410).json({
      success: false,
      code: 'LEGACY_MIME_INBOUND_DISABLED',
      message:
        'Legacy MIME inbound webhook is disabled. Use the Arivu Inbound Parser email.received webhook (see server/docs/INBOUND_PARSER_CRM_INTEGRATION.md).'
    });
  }
  return next();
}

module.exports = {
  requireGmailIntegration,
  requireLegacyMimeInboundWebhook
};
