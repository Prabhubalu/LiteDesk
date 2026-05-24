'use strict';

/**
 * Email integration feature flags.
 *
 * Defaults avoid Google OAuth / Gmail API (CASA) and the legacy MIME inbound webhook.
 * Inbound mail is expected from the external Arivu Inbound Parser (see docs).
 *
 * Re-enable later:
 *   ENABLE_GMAIL_INTEGRATION=true
 *   ENABLE_LEGACY_MIME_INBOUND_WEBHOOK=true
 */

function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return String(raw).trim().toLowerCase() === 'true';
}

function isGmailIntegrationEnabled() {
  return envBool('ENABLE_GMAIL_INTEGRATION', false);
}

function isLegacyMimeInboundWebhookEnabled() {
  return envBool('ENABLE_LEGACY_MIME_INBOUND_WEBHOOK', false);
}

function getEmailIntegrationCapabilities() {
  return {
    gmailIntegrationEnabled: isGmailIntegrationEnabled(),
    legacyMimeInboundEnabled: isLegacyMimeInboundWebhookEnabled(),
    inboundMode: isLegacyMimeInboundWebhookEnabled() ? 'legacy_mime_webhook' : 'inbound_parser',
    outboundModes: ['resend', 'oci_system', 'tenant_smtp']
  };
}

function logEmailFeatureFlagsAtStartup() {
  const caps = getEmailIntegrationCapabilities();
  console.log(
    `📧 Email: inbound=${caps.inboundMode}, gmail=${caps.gmailIntegrationEnabled ? 'on' : 'off'}, legacyMimeWebhook=${caps.legacyMimeInboundEnabled ? 'on' : 'off'}`
  );
}

module.exports = {
  isGmailIntegrationEnabled,
  isLegacyMimeInboundWebhookEnabled,
  getEmailIntegrationCapabilities,
  logEmailFeatureFlagsAtStartup
};
