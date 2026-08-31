'use strict';

/**
 * AMDS (Arivu Mail Delivery System) — platform outbound email via HTTP API.
 * Arivu never opens SMTP for the AMDS path.
 * @see docs/ARIVU-INTEGRATION.md
 */

const { getAmdsClient, isAmdsEnvConfigured } = require('../../config/amds');
const { AmdsApiError } = require('../amds/amds-errors');
const { assertEmailSendingAllowed } = require('../orgEmailPolicyService');
const { buildIdempotencyKey } = require('../../utils/arivuMetadata');

const PROVIDER_KEY = 'amds';

const NAMED_EMAIL_RE = /^(.+?)\s*<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>$/;
const PLAIN_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeProvider(value) {
  return String(value || '').trim().toLowerCase();
}

function isAmdsProvider(runtimeConfig = {}) {
  return normalizeProvider(runtimeConfig.provider) === PROVIDER_KEY;
}

function applyAmdsDefaults(runtimeConfig = {}) {
  if (!isAmdsProvider(runtimeConfig)) {
    return { ...runtimeConfig };
  }
  return {
    ...runtimeConfig,
    provider: PROVIDER_KEY
  };
}

function isAmdsConfigured(runtimeConfig = {}) {
  if (!isAmdsProvider(runtimeConfig)) return false;
  const merged = applyAmdsDefaults(runtimeConfig);
  if (!merged.fromEmail) return false;
  return isAmdsEnvConfigured();
}

/**
 * @param {string} address
 * @returns {{ email: string, name?: string }|null}
 */
function parseEmailAddress(address) {
  const raw = String(address || '').trim();
  if (!raw) return null;

  const named = raw.match(NAMED_EMAIL_RE);
  if (named) {
    const name = named[1].replace(/^["']|["']$/g, '').trim();
    return name ? { email: named[2].trim(), name } : { email: named[2].trim() };
  }

  if (PLAIN_EMAIL_RE.test(raw)) {
    return { email: raw };
  }

  const angle = raw.match(/<([^<>]+)>/);
  if (angle && PLAIN_EMAIL_RE.test(angle[1].trim())) {
    return { email: angle[1].trim() };
  }

  return null;
}

/**
 * @param {string|string[]|undefined} value
 * @returns {{ email: string, name?: string }[]}
 */
function parseEmailAddressList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(parseEmailAddress).filter(Boolean);
}

/**
 * @param {{ moduleKey?: string, organizationId: string, communicationId: string }} params
 */
function buildCommunicationIdempotencyKey(params) {
  const moduleKey = String(params.moduleKey || 'crm').trim();
  const orgId = String(params.organizationId || '').trim();
  const commId = String(params.communicationId || '').trim();
  return buildIdempotencyKey(moduleKey, orgId, 'comm', commId);
}

/**
 * @param {Object} opts
 * @param {string} [opts.from]
 * @param {string|string[]} opts.to
 * @param {string|string[]} [opts.cc]
 * @param {string|string[]} [opts.bcc]
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {string} [opts.organizationId]
 * @param {string} [opts.tenantId]
 * @param {string} [opts.idempotencyKey]
 * @param {Record<string, unknown>} [opts.metadata]
 * @param {string[]} [opts.tags]
 * @param {{ opens: boolean, clicks: boolean }} [opts.tracking]
 * @returns {Promise<{ success: boolean, messageId?: string, provider?: string, deliveryStatus?: string, error?: string }>}
 */
async function sendViaAmds(opts = {}) {
  const client = getAmdsClient();
  if (!client) {
    return { success: false, error: 'AMDS is not configured', provider: PROVIDER_KEY };
  }

  const from = parseEmailAddress(opts.from);
  const to = parseEmailAddressList(opts.to);
  if (!from) {
    return { success: false, error: 'Invalid from address', provider: PROVIDER_KEY };
  }
  if (to.length === 0) {
    return { success: false, error: 'Missing to address', provider: PROVIDER_KEY };
  }

  const tenantId = String(opts.tenantId || opts.organizationId || '').trim();
  if (!tenantId) {
    return { success: false, error: 'Missing tenant_id (organizationId)', provider: PROVIDER_KEY };
  }

  const sendGate = await assertEmailSendingAllowed(tenantId);
  if (!sendGate.allowed) {
    return {
      success: false,
      error: sendGate.error,
      code: sendGate.code,
      provider: PROVIDER_KEY
    };
  }

  const text = opts.text || (opts.html ? String(opts.html).replace(/<[^>]+>/g, '') : '');
  const html = opts.html || undefined;
  if (!text && !html) {
    return { success: false, error: 'Missing email content (text or html)', provider: PROVIDER_KEY };
  }

  const cc = parseEmailAddressList(opts.cc);
  const bcc = parseEmailAddressList(opts.bcc);

  /** @type {import('../amds/amds-types').SendMessageRequest} */
  const payload = {
    idempotency_key: String(opts.idempotencyKey || '').trim().slice(0, 256),
    tenant_id: tenantId.slice(0, 128),
    from,
    to,
    subject: String(opts.subject || '').slice(0, 998),
    content: {
      ...(html ? { html } : {}),
      ...(text ? { text } : {})
    },
    metadata: opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : undefined,
    tags: Array.isArray(opts.tags) ? opts.tags : ['transactional']
  };

  if (opts.tracking && typeof opts.tracking === 'object') {
    payload.tracking = {
      opens: !!opts.tracking.opens,
      clicks: !!opts.tracking.clicks
    };
  }

  if (!payload.idempotency_key) {
    return { success: false, error: 'Missing idempotency_key', provider: PROVIDER_KEY };
  }
  if (cc.length) payload.cc = cc;
  if (bcc.length) payload.bcc = bcc;

  try {
    const response = await client.sendMessage(payload);
    return {
      success: true,
      messageId: response.message_id,
      provider: PROVIDER_KEY,
      deliveryStatus: response.status || 'queued'
    };
  } catch (err) {
    if (err instanceof AmdsApiError) {
      if (err.isSuppressedRecipient) {
        const suppressed = Array.isArray(err.body.suppressed) ? err.body.suppressed : [];
        return {
          success: false,
          error: `Cannot send — recipient is suppressed: ${suppressed.join(', ') || 'unknown'}`,
          code: 'AMDS_SUPPRESSED_RECIPIENT',
          provider: PROVIDER_KEY,
          suppressed
        };
      }
      if (err.isDomainNotVerified) {
        const domain = err.body.domain ? String(err.body.domain) : 'unknown';
        return {
          success: false,
          error: err.userMessage,
          code: 'AMDS_DOMAIN_NOT_VERIFIED',
          provider: PROVIDER_KEY,
          domain
        };
      }
      if (err.isInsufficientCredits) {
        return {
          success: false,
          error: err.userMessage,
          code: 'AMDS_INSUFFICIENT_CREDITS',
          provider: PROVIDER_KEY
        };
      }
      if (err.isCampaignSizeExceeded) {
        return {
          success: false,
          error: err.userMessage,
          code: 'AMDS_CAMPAIGN_SIZE_EXCEEDED',
          provider: PROVIDER_KEY,
          limit: err.body?.limit
        };
      }
      if (err.isRateLimited) {
        return {
          success: false,
          error: err.userMessage,
          code: 'AMDS_RATE_LIMIT_EXCEEDED',
          provider: PROVIDER_KEY
        };
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[amdsEmailDelivery] send failed:', message);
    return { success: false, error: message, provider: PROVIDER_KEY };
  }
}

function defaultProviderWhenUnset() {
  return isAmdsEnvConfigured() ? PROVIDER_KEY : null;
}

module.exports = {
  PROVIDER_KEY,
  isAmdsProvider,
  applyAmdsDefaults,
  isAmdsConfigured,
  isAmdsEnvConfigured,
  parseEmailAddress,
  parseEmailAddressList,
  buildCommunicationIdempotencyKey,
  sendViaAmds,
  defaultProviderWhenUnset
};
