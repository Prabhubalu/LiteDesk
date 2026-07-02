const emailService = require('../../../services/emailService');
const ociEmailDelivery = require('../../../services/emailProviders/ociEmailDelivery');
const amdsEmailDelivery = require('../../../services/emailProviders/amdsEmailDelivery');
const EMAIL_PROVIDER_KEY = emailService.EMAIL_PROVIDER_KEY || 'email-provider';

function getActiveProviderKey() {
  if (!emailService.isConfigured()) return 'none';
  const explicitProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (explicitProvider) return explicitProvider;

  if (amdsEmailDelivery.isAmdsEnvConfigured()) return amdsEmailDelivery.PROVIDER_KEY;

  if (process.env.OCI_EMAIL_REGION || process.env.OCI_REGION) return ociEmailDelivery.PROVIDER_KEY;

  if (process.env.AWS_SES_REGION) return 'aws-ses';

  const smtpHost = (process.env.SMTP_HOST || '').toLowerCase();
  if (smtpHost.includes('resend.com')) return 'resend';
  if (smtpHost.includes('oraclecloud.com')) return ociEmailDelivery.PROVIDER_KEY;

  return 'smtp';
}

function getSystemProviderKey() {
  if (!emailService.isSystemEmailConfigured()) return 'none';
  const explicit = (
    process.env.SYSTEM_EMAIL_PROVIDER || amdsEmailDelivery.defaultProviderWhenUnset() || 'oci-email-delivery'
  )
    .trim()
    .toLowerCase();
  return explicit || ociEmailDelivery.PROVIDER_KEY;
}

async function sendEmail(payload) {
  const result = await emailService.sendCrmEmail(payload);
  return {
    ...result,
    provider: result.provider || getActiveProviderKey()
  };
}

async function sendSystemEmail(payload) {
  const result = await emailService.sendSystemEmail(payload);
  return {
    ...result,
    provider: result.provider || getSystemProviderKey(),
    channel: 'system'
  };
}

async function sendCrmEmail(payload) {
  return sendEmail(payload);
}

async function isConfigured(context = {}) {
  if (context.organizationId) {
    return emailService.isConfiguredForOrganization(context.organizationId);
  }
  return emailService.isConfigured();
}

function isSystemConfigured() {
  return emailService.isSystemEmailConfigured();
}

module.exports = {
  EMAIL_PROVIDER_KEY,
  getActiveProviderKey,
  getSystemProviderKey,
  isConfigured,
  isSystemConfigured,
  sendEmail,
  sendSystemEmail,
  sendCrmEmail
};
