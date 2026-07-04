/**
 * Email service - sends transactional and notification emails.
 * Supports provider-agnostic delivery via environment configuration.
 * Providers: Resend (SMTP/API), AWS SES, OCI Email Delivery (SMTP), generic SMTP.
 * Never throws; returns { success, messageId?, error? } for all operations.
 */

const EMAIL_PROVIDER_KEY = 'email-provider';
const ociEmailDelivery = require('./emailProviders/ociEmailDelivery');
const amdsEmailDelivery = require('./emailProviders/amdsEmailDelivery');
const {
  resolveSystemRuntimeConfig,
  resolveCrmRuntimeConfig
} = require('../platform/communication/email/runtimeConfigResolver');
const { isResendProvider } = require('../constants/resendDefaults');

function isTruthy(value) {
  return String(value || '').toLowerCase() === 'true';
}

/** @deprecated Use resolveCrmRuntimeConfig — kept for callers passing raw org config objects */
function resolveRuntimeConfig(config = {}) {
  return resolveCrmRuntimeConfig(config);
}

async function resolveRuntimeConfigForChannel(channel = 'crm', organizationId = null) {
  if (channel === 'system') {
    return resolveSystemRuntimeConfig();
  }
  const orgConfig = await getOrganizationEmailConfig(organizationId);
  return resolveCrmRuntimeConfig(orgConfig || {});
}

function shouldUseAmds(runtimeConfig = {}) {
  return amdsEmailDelivery.isAmdsProvider(runtimeConfig);
}

function isSmtpFallbackReady(runtimeConfig) {
  if (shouldUseOciSmtp(runtimeConfig) && ociEmailDelivery.isOciEmailDeliveryConfigured(runtimeConfig)) {
    return true;
  }
  return !!createSmtpTransport(runtimeConfig);
}

function hasResendApiKey(runtimeConfig = {}) {
  return !!String(runtimeConfig.smtpPass || process.env.RESEND_API_KEY || '').trim();
}

function isRuntimeConfigReady(runtimeConfig) {
  if (!runtimeConfig?.fromEmail) return false;
  if (shouldUseAmds(runtimeConfig) && amdsEmailDelivery.isAmdsConfigured(runtimeConfig)) {
    return true;
  }
  if (isResendProvider(runtimeConfig)) {
    return hasResendApiKey(runtimeConfig);
  }
  if (shouldUseOciSmtp(runtimeConfig) && ociEmailDelivery.isOciEmailDeliveryConfigured(runtimeConfig)) {
    return true;
  }
  if (shouldUseSes(runtimeConfig) && createSesClient(runtimeConfig)) return true;
  const transport = createSmtpTransport(runtimeConfig);
  if (!transport) return false;
  if (runtimeConfig.smtpUser || runtimeConfig.smtpPass) {
    return !!(runtimeConfig.smtpUser && runtimeConfig.smtpPass);
  }
  return true;
}

function normalizeProviderKey(runtimeConfig = {}) {
  const p = String(runtimeConfig.provider || '').trim().toLowerCase();
  if (p === 'gmail-smtp') return 'smtp';
  return p;
}

function shouldUseSes(runtimeConfig = {}) {
  const provider = normalizeProviderKey(runtimeConfig);
  if (provider === 'aws-ses') return true;
  if (provider === 'oci-email-delivery' || provider === 'oci' || provider === 'resend' || provider === 'smtp') {
    return false;
  }
  return !!createSesClient(runtimeConfig);
}

function shouldUseOciSmtp(runtimeConfig = {}) {
  return ociEmailDelivery.isOciEmailDeliveryProvider(runtimeConfig);
}

function resolveSafeReplyToAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const plainEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const namedEmailPattern = /^[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>]+>$/;
  if (plainEmailPattern.test(raw) || namedEmailPattern.test(raw)) {
    return raw;
  }
  return undefined;
}

function createSesClient(runtimeConfig) {
  if (!runtimeConfig.awsRegion || !runtimeConfig.awsAccessKeyId || !runtimeConfig.awsSecretAccessKey) {
    return null;
  }
  try {
    const { SESClient } = require('@aws-sdk/client-ses');
    return new SESClient({
      region: runtimeConfig.awsRegion,
      credentials: {
        accessKeyId: runtimeConfig.awsAccessKeyId,
        secretAccessKey: runtimeConfig.awsSecretAccessKey
      }
    });
  } catch (err) {
    console.error('[emailService] Failed to create SES client:', err.message);
    return null;
  }
}

function createSmtpTransport(runtimeConfig) {
  if (!runtimeConfig.smtpHost || !runtimeConfig.smtpPort) return null;
  try {
    const nodemailer = require('nodemailer');
    const isOci = ociEmailDelivery.isOciEmailDeliveryProvider(runtimeConfig);
    let port = runtimeConfig.smtpPort;
    let secure = runtimeConfig.smtpSecure === true;
    if (isOci) {
      if (port === 587 || port === 25) {
        port = ociEmailDelivery.DEFAULT_SMTP_PORT;
      }
      secure = port === 465;
    } else if (port === 587 && secure) {
      // STARTTLS on 587: do not open with implicit TLS (causes wrong version number).
      secure = false;
    }
    return nodemailer.createTransport({
      host: runtimeConfig.smtpHost,
      port,
      secure,
      auth: runtimeConfig.smtpUser && runtimeConfig.smtpPass
        ? { user: runtimeConfig.smtpUser, pass: runtimeConfig.smtpPass }
        : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    });
  } catch (err) {
    console.error('[emailService] Failed to create SMTP transport:', err.message);
    return null;
  }
}

async function getOrganizationEmailConfig(organizationId) {
  if (!organizationId) return null;
  try {
    const Organization = require('../models/Organization');
    const org = await Organization.findById(organizationId).select('integrations').lean();
    const config = org?.integrations?.[EMAIL_PROVIDER_KEY]?.config;
    if (!config || typeof config !== 'object') return null;
    return config;
  } catch (err) {
    console.error('[emailService] Failed to resolve organization email config:', err.message);
    return null;
  }
}

/**
 * Check if email service is configured (SES or SMTP).
 * Requires EMAIL_FROM for a valid sender address.
 * @returns {boolean}
 */
function isConfigured() {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') return false;
  return isRuntimeConfigReady(resolveCrmRuntimeConfig());
}

function isSystemEmailConfigured() {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') return false;
  return isRuntimeConfigReady(resolveSystemRuntimeConfig());
}

async function isConfiguredForOrganization(organizationId) {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') return false;
  const runtimeConfig = await resolveRuntimeConfigForChannel('crm', organizationId);
  return isRuntimeConfigReady(runtimeConfig);
}

function isConfiguredFromResolvedConfig(resolvedConfig = {}) {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'false') return false;
  return isRuntimeConfigReady(resolveCrmRuntimeConfig(resolvedConfig));
}

/**
 * Get from address. Uses EMAIL_FROM and optionally EMAIL_FROM_NAME.
 */
function getFromAddress() {
  const from = process.env.EMAIL_FROM || 'noreply@arivusystems.com';
  const name = process.env.EMAIL_FROM_NAME || 'Arivu Systems';
  return name ? `"${name}" <${from}>` : from;
}

function isResendRuntime(runtimeConfig) {
  return isResendProvider(runtimeConfig);
}

async function sendViaResendApi(runtimeConfig, payload) {
  const apiKey = String(runtimeConfig.smtpPass || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    return { success: false, error: 'Resend API key missing' };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.message || data?.error || `HTTP ${response.status}`;
      return { success: false, error: `Resend API send failed: ${detail}` };
    }
    return { success: true, messageId: data?.id || data?.data?.id, provider: 'resend-api' };
  } catch (err) {
    return { success: false, error: `Resend API send failed: ${err.message}` };
  }
}

/**
 * Send an email.
 * @param {Object} opts - { to, cc?, bcc?, subject, text, html?, replyTo?, attachments?, organizationId?, channel?: 'crm'|'system', metadata?, idempotencyKey?, tags?, communicationId?, moduleKey? }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, provider?: string, deliveryStatus?: string }>}
 */
async function sendEmail(opts) {
  const {
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    replyTo,
    attachments = [],
    organizationId,
    channel = 'crm',
    metadata,
    idempotencyKey,
    tags,
    communicationId,
    moduleKey
  } = opts || {};
  if (!to || !subject) {
    return { success: false, error: 'Missing to or subject' };
  }

  const toList = Array.isArray(to) ? to : [to];
  if (toList.length === 0 || !toList[0]) {
    return { success: false, error: 'Missing to address' };
  }

  const runtimeConfig = await resolveRuntimeConfigForChannel(channel, organizationId);
  const from = runtimeConfig.fromName
    ? `"${runtimeConfig.fromName}" <${runtimeConfig.fromEmail || 'noreply@arivusystems.com'}>`
    : (runtimeConfig.fromEmail || getFromAddress());
  const replyToAddr = resolveSafeReplyToAddress(replyTo || runtimeConfig.replyTo);

  const hasAttachments = attachments && attachments.length > 0;
  const smtpProviderTag = shouldUseOciSmtp(runtimeConfig)
    ? ociEmailDelivery.PROVIDER_KEY
    : 'smtp';

  const sendViaSmtpTransport = async (transport) => {
    const info = await transport.sendMail({
      from,
      to: toList,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
      html: html || undefined,
      replyTo: replyToAddr,
      ...(hasAttachments
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename || a.fileName || 'attachment',
              content: a.content
            }))
          }
        : {})
    });
    return { success: true, messageId: info.messageId, provider: smtpProviderTag };
  };

  if (shouldUseAmds(runtimeConfig)) {
    if (hasAttachments && !isSmtpFallbackReady(runtimeConfig)) {
      return {
        success: false,
        error:
          'Attachments require SMTP until AMDS attachment support is available. Configure SMTP or remove attachments.'
      };
    }
    if (hasAttachments && isSmtpFallbackReady(runtimeConfig)) {
      const transport = createSmtpTransport(runtimeConfig);
      if (transport) {
        try {
          return await sendViaSmtpTransport(transport);
        } catch (err) {
          console.error('[emailService] AMDS attachment SMTP fallback failed:', err.message);
          return { success: false, error: err.message };
        }
      }
    }

    const resolvedIdempotencyKey =
      idempotencyKey
      || (communicationId && organizationId
        ? amdsEmailDelivery.buildCommunicationIdempotencyKey({
            moduleKey,
            organizationId: String(organizationId),
            communicationId: String(communicationId)
          })
        : `litedesk-${channel}-${String(organizationId || 'system')}-${Date.now()}`);

    const amdsMetadata = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      ...(organizationId ? { litedesk_org_id: String(organizationId) } : {}),
      ...(communicationId ? { litedesk_entity_id: String(communicationId) } : {}),
      ...(communicationId ? { litedesk_communication_id: String(communicationId) } : {}),
      ...(moduleKey ? { litedesk_module: String(moduleKey) } : {})
    };

    return amdsEmailDelivery.sendViaAmds({
      from,
      to: toList,
      cc,
      bcc,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
      html: html || undefined,
      organizationId,
      idempotencyKey: resolvedIdempotencyKey,
      metadata: amdsMetadata,
      tags
    });
  }

  if (hasAttachments) {
    const transport = createSmtpTransport(runtimeConfig);
    if (!transport) {
      return {
        success: false,
        error: 'Attachments require SMTP. Configure SMTP (e.g. Mailtrap or OCI Email Delivery) for attachment support.'
      };
    }
    try {
      return await sendViaSmtpTransport(transport);
    } catch (err) {
      console.error('[emailService] SMTP send failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  if (shouldUseOciSmtp(runtimeConfig)) {
    const transport = createSmtpTransport(runtimeConfig);
    if (!transport) {
      return {
        success: false,
        error:
          'OCI Email Delivery is not configured. Set OCI_EMAIL_REGION (or smtpHost), SMTP user/password from OCI SMTP credentials, and an approved sender as From Email.'
      };
    }
    try {
      return await sendViaSmtpTransport(transport);
    } catch (err) {
      console.error('[emailService] OCI Email Delivery SMTP send failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  if (isResendProvider(runtimeConfig) && !hasAttachments) {
    const apiResult = await sendViaResendApi(runtimeConfig, {
      from,
      to: toList,
      subject,
      html: html || undefined,
      text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
      reply_to: replyToAddr
    });
    if (apiResult.success) {
      return apiResult;
    }
    console.warn('[emailService] Resend API send failed, trying SMTP:', apiResult.error);
  }

  const client = shouldUseSes(runtimeConfig) ? createSesClient(runtimeConfig) : null;
  if (client) {
    try {
      const { SendEmailCommand } = require('@aws-sdk/client-ses');
      const command = new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: toList },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: text || (html ? html.replace(/<[^>]+>/g, '') : ''), Charset: 'UTF-8' },
            Html: html ? { Data: html, Charset: 'UTF-8' } : undefined
          }
        },
        ReplyToAddresses: replyToAddr ? [replyToAddr] : undefined
      });
      const result = await client.send(command);
      return { success: true, messageId: result.MessageId, provider: 'aws-ses' };
    } catch (err) {
      console.error('[emailService] SES send failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  const transport = createSmtpTransport(runtimeConfig);
  if (transport) {
    try {
      return await sendViaSmtpTransport(transport);
    } catch (err) {
      console.error('[emailService] SMTP send failed:', err.message);
      const isDnsLookupError = /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(String(err?.message || ''));
      if (!hasAttachments && isDnsLookupError && isResendRuntime(runtimeConfig)) {
        const fallback = await sendViaResendApi(runtimeConfig, {
          from,
          to: toList,
          subject,
          html: html || undefined,
          text: text || (html ? html.replace(/<[^>]+>/g, '') : ''),
          reply_to: replyToAddr
        });
        if (fallback.success) {
          console.warn('[emailService] SMTP DNS lookup failed; sent via Resend API fallback');
          return fallback;
        }
        console.error('[emailService] Resend API fallback failed:', fallback.error);
      }
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Email service not configured' };
}

/** System mail (notifications, OTP, password reset) — OCI by default, ignores tenant CRM provider. */
async function sendSystemEmail(opts) {
  return sendEmail({ ...opts, channel: 'system' });
}

/** CRM/agent transactional mail — tenant integration + EMAIL_PROVIDER. */
async function sendCrmEmail(opts) {
  return sendEmail({ ...opts, channel: 'crm' });
}

module.exports = {
  EMAIL_PROVIDER_KEY,
  isConfigured,
  isSystemEmailConfigured,
  isConfiguredForOrganization,
  isConfiguredFromResolvedConfig,
  getOrganizationEmailConfig,
  resolveRuntimeConfigForChannel,
  sendEmail,
  sendSystemEmail,
  sendCrmEmail
};
