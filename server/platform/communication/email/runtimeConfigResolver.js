'use strict';

/**
 * R0 — Split runtime email configuration:
 * - **system**: OTP, password reset, notification digests (OCI Email Delivery by default)
 * - **crm**: Agent/workspace sends via platform queue (tenant integration or env)
 */

const ociEmailDelivery = require('../../../services/emailProviders/ociEmailDelivery');
const amdsEmailDelivery = require('../../../services/emailProviders/amdsEmailDelivery');
const { applyResendDefaults, RESEND_PROVIDER } = require('../../../constants/resendDefaults');

function defaultCrmProvider() {
  return amdsEmailDelivery.defaultProviderWhenUnset() || RESEND_PROVIDER;
}

function defaultSystemProvider() {
  return amdsEmailDelivery.defaultProviderWhenUnset() || 'oci-email-delivery';
}

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

function baseEnvFields() {
  const smtpPort = parseInt(process.env.SMTP_PORT || '0', 10);
  return {
    fromEmail: process.env.EMAIL_FROM || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Arivu Systems',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    ociRegion: process.env.OCI_EMAIL_REGION || process.env.OCI_REGION || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number.isNaN(smtpPort) ? 0 : smtpPort,
    smtpUser: process.env.SMTP_USER || process.env.OCI_SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || process.env.OCI_SMTP_PASS || '',
    smtpSecure: smtpPort === 465 || isTruthy(process.env.SMTP_SECURE),
    awsRegion: process.env.AWS_SES_REGION || '',
    awsAccessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || ''
  };
}

/**
 * System mail must not use tenant CRM integration overrides unless explicitly allowed.
 * Default provider: oci-email-delivery (blueprint: system mail via OCI only).
 */
function resolveSystemRuntimeConfig() {
  const allowTenantOverride = isTruthy(process.env.SYSTEM_EMAIL_ALLOW_TENANT_PROVIDER);
  if (allowTenantOverride) {
    return null;
  }

  const provider =
    String(process.env.SYSTEM_EMAIL_PROVIDER || defaultSystemProvider()).trim().toLowerCase() ||
    defaultSystemProvider();

  const cfg = {
    ...baseEnvFields(),
    provider,
    fromEmail: process.env.SYSTEM_EMAIL_FROM || process.env.EMAIL_FROM || '',
    fromName: process.env.SYSTEM_EMAIL_FROM_NAME || process.env.EMAIL_FROM_NAME || 'Arivu Systems',
    replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || process.env.EMAIL_REPLY_TO || '',
    smtpHost: process.env.SYSTEM_SMTP_HOST || process.env.SMTP_HOST || '',
    smtpUser: process.env.SYSTEM_SMTP_USER || process.env.SMTP_USER || process.env.OCI_SMTP_USER || '',
    smtpPass: process.env.SYSTEM_SMTP_PASS || process.env.SMTP_PASS || process.env.OCI_SMTP_PASS || '',
    ociRegion:
      process.env.SYSTEM_OCI_EMAIL_REGION ||
      process.env.OCI_EMAIL_REGION ||
      process.env.OCI_REGION ||
      ''
  };

  const smtpPortRaw =
    process.env.SYSTEM_SMTP_PORT || process.env.SMTP_PORT || ociEmailDelivery.DEFAULT_SMTP_PORT;
  const smtpPort = parseInt(smtpPortRaw, 10);
  cfg.smtpPort = Number.isNaN(smtpPort) ? ociEmailDelivery.DEFAULT_SMTP_PORT : smtpPort;
  cfg.smtpSecure = cfg.smtpPort === 465 || isTruthy(process.env.SYSTEM_SMTP_SECURE);

  if (amdsEmailDelivery.isAmdsProvider(cfg)) {
    return amdsEmailDelivery.applyAmdsDefaults(cfg);
  }
  return ociEmailDelivery.applyOciEmailDeliveryDefaults(cfg);
}

/**
 * CRM/agent sends: tenant integration config merged over env (existing behavior).
 * @param {object | null} orgIntegrationConfig
 */
function resolveCrmRuntimeConfig(orgIntegrationConfig = null) {
  const org = orgIntegrationConfig || {};
  const smtpPort = parseInt(org.smtpPort || process.env.SMTP_PORT || '0', 10);
  const provider =
    String(org.provider || process.env.EMAIL_PROVIDER || defaultCrmProvider()).trim().toLowerCase() ||
    defaultCrmProvider();

  const cfg = {
    ...baseEnvFields(),
    provider,
    fromEmail: org.fromEmail || process.env.EMAIL_FROM || '',
    fromName: org.fromName || process.env.EMAIL_FROM_NAME || 'Arivu Systems',
    replyTo: org.replyTo || process.env.EMAIL_REPLY_TO || '',
    ociRegion: org.ociRegion || process.env.OCI_EMAIL_REGION || process.env.OCI_REGION || '',
    smtpHost: org.smtpHost || process.env.SMTP_HOST || '',
    smtpPort: Number.isNaN(smtpPort) ? 0 : smtpPort,
    smtpUser: org.smtpUser || process.env.SMTP_USER || '',
    smtpPass:
      org.smtpPass || process.env.SMTP_PASS || process.env.RESEND_API_KEY || '',
    smtpSecure:
      org.smtpSecure === true || isTruthy(org.smtpSecure) || smtpPort === 465,
    awsRegion: org.awsRegion || process.env.AWS_SES_REGION || '',
    awsAccessKeyId: org.awsAccessKeyId || process.env.AWS_SES_ACCESS_KEY_ID || '',
    awsSecretAccessKey:
      org.awsSecretAccessKey || process.env.AWS_SES_SECRET_ACCESS_KEY || ''
  };

  if (amdsEmailDelivery.isAmdsProvider(cfg)) {
    return amdsEmailDelivery.applyAmdsDefaults(cfg);
  }
  return applyResendDefaults(ociEmailDelivery.applyOciEmailDeliveryDefaults(cfg));
}

module.exports = {
  resolveSystemRuntimeConfig,
  resolveCrmRuntimeConfig
};
