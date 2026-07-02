const Organization = require('../models/Organization');
const emailService = require('./emailService');
const { applyResendDefaults } = require('../constants/resendDefaults');
const amdsEmailDelivery = require('./emailProviders/amdsEmailDelivery');
const {
  upsertCommunicationConfigForOrganization
} = require('../platform/communication/config/communicationConfigService');

function defaultEmailConfigFromEnv() {
  const smtpPortRaw = process.env.SMTP_PORT;
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) || 587 : 587;
  return applyResendDefaults({
    provider: String(
      process.env.EMAIL_PROVIDER || amdsEmailDelivery.defaultProviderWhenUnset() || 'resend'
    )
      .trim()
      .toLowerCase(),
    fromEmail: String(process.env.EMAIL_FROM || '').trim(),
    fromName: String(process.env.EMAIL_FROM_NAME || 'Arivu Systems').trim(),
    replyTo: String(process.env.EMAIL_REPLY_TO || '').trim(),
    smtpHost: String(process.env.SMTP_HOST || '').trim(),
    smtpPort,
    smtpUser: String(process.env.SMTP_USER || '').trim(),
    smtpPass: String(process.env.SMTP_PASS || process.env.RESEND_API_KEY || ''),
    smtpSecure: String(smtpPort) === '465'
  });
}

async function ensureDefaultCommunicationSettingsForOrganization(organizationId) {
  if (!organizationId) return { updated: false };
  const org = await Organization.findById(organizationId);
  if (!org) return { updated: false };

  const integrationKey = emailService.EMAIL_PROVIDER_KEY;
  const integrations = org.integrations || {};
  const existing = integrations[integrationKey] || {};
  const existingConfig = existing.config || {};
  const envDefaults = defaultEmailConfigFromEnv();

  const seededConfig = applyResendDefaults({
    provider: existingConfig.provider || envDefaults.provider,
    fromEmail: existingConfig.fromEmail || envDefaults.fromEmail,
    fromName: existingConfig.fromName || envDefaults.fromName,
    replyTo: existingConfig.replyTo || envDefaults.replyTo,
    smtpHost: existingConfig.smtpHost || envDefaults.smtpHost,
    smtpPort: existingConfig.smtpPort || envDefaults.smtpPort,
    smtpUser: existingConfig.smtpUser || envDefaults.smtpUser,
    smtpPass: existingConfig.smtpPass || envDefaults.smtpPass,
    smtpSecure: existingConfig.smtpSecure === true || envDefaults.smtpSecure === true
  });

  const nextState = {
    ...existing,
    enabled: existing.enabled !== false,
    status: existing.status || 'connected',
    connectedAt: existing.connectedAt || new Date(),
    config: seededConfig,
    updatedAt: new Date()
  };

  org.integrations = {
    ...integrations,
    [integrationKey]: nextState
  };
  org.markModified('integrations');
  await org.save();

  await upsertCommunicationConfigForOrganization(organizationId, {
    outboundEmail: {
      enabled: true,
      maxRecipientsPerMessage: 50,
      allowedModuleKeys: ['people', 'organizations', 'deals', 'tasks', 'cases']
    }
  });

  return { updated: true };
}

module.exports = {
  ensureDefaultCommunicationSettingsForOrganization
};
