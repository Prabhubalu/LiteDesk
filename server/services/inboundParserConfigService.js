'use strict';

const PlatformInboundParserConfig = require('../models/PlatformInboundParserConfig');
const { encryptTenantSecret, decryptTenantSecret } = require('../utils/tenantSecretCrypto');

const CONFIG_ID = 'default';
const WEBHOOK_PATH = '/api/webhooks/arivu/inbound-email';

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function buildDerivedUrls({ parserApiBaseUrl, crmPublicApiBaseUrl }) {
  const parser = normalizeBaseUrl(parserApiBaseUrl);
  const crm = normalizeBaseUrl(crmPublicApiBaseUrl);
  return {
    parserApiBaseUrl: parser,
    crmPublicApiBaseUrl: crm,
    crmWebhookUrl: crm ? `${crm}${WEBHOOK_PATH}` : '',
    parserProvisionUrl: parser ? `${parser}/integrations/v1/mailboxes` : '',
    parserAdminMessageUrlTemplate: parser
      ? `${parser}/integrations/v1/messages/{messageId}`
      : ''
  };
}

async function loadConfigDoc() {
  let doc = await PlatformInboundParserConfig.findById(CONFIG_ID).lean();
  if (!doc) {
    doc = (
      await PlatformInboundParserConfig.create({
        _id: CONFIG_ID,
        parserApiBaseUrl: '',
        crmPublicApiBaseUrl: '',
        enabled: false
      })
    ).toObject();
  }
  return doc;
}

function resolveFromEnv() {
  const parserApiBaseUrl = normalizeBaseUrl(
    process.env.PARSER_API_BASE_URL || process.env.PARSER_API_URL || ''
  );
  const crmPublicApiBaseUrl = normalizeBaseUrl(
    process.env.CRM_PUBLIC_API_BASE_URL
      || process.env.API_PUBLIC_BASE_URL
      || process.env.PUBLIC_API_BASE_URL
      || ''
  );
  const parserApiKey = String(process.env.PARSER_CRM_API_KEY || process.env.CRM_API_KEY || '').trim();
  const webhookSecret = String(
    process.env.ARIVU_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || ''
  ).trim();
  const enabledEnv = process.env.INBOUND_PARSER_ENABLED;
  const enabled =
    enabledEnv === undefined || enabledEnv === ''
      ? Boolean(parserApiBaseUrl && crmPublicApiBaseUrl)
      : String(enabledEnv).trim().toLowerCase() === 'true';

  return {
    parserApiBaseUrl,
    crmPublicApiBaseUrl,
    parserApiKey,
    webhookSecret,
    enabled: enabled && Boolean(parserApiBaseUrl),
    source: 'env'
  };
}

/**
 * Effective config: Control Plane (DB) when enabled; merge secrets from DB + env.
 */
async function getEffectiveInboundParserConfig() {
  const doc = await loadConfigDoc();
  const env = resolveFromEnv();

  const dbEnabled = doc.enabled === true;
  const dbParserUrl = normalizeBaseUrl(doc.parserApiBaseUrl);
  const dbCrmUrl = normalizeBaseUrl(doc.crmPublicApiBaseUrl);

  const dbParserKey = decryptTenantSecret(doc.encryptedParserApiKey);
  const dbWebhookSecret = decryptTenantSecret(doc.encryptedWebhookSecret);

  // When enabled in Control Plane, prefer DB URLs but fall back to env for partial setups.
  const parserApiBaseUrl =
  (dbEnabled && dbParserUrl) || env.parserApiBaseUrl || dbParserUrl || '';
  const crmPublicApiBaseUrl =
  (dbEnabled && dbCrmUrl) || env.crmPublicApiBaseUrl || dbCrmUrl || '';

  const parserApiKey = dbParserKey || env.parserApiKey;
  const webhookSecret = dbWebhookSecret || env.webhookSecret;

  const enabled =
    (dbEnabled && Boolean(parserApiBaseUrl))
    || (!dbEnabled && env.enabled && Boolean(env.parserApiBaseUrl));

  const urls = buildDerivedUrls({ parserApiBaseUrl, crmPublicApiBaseUrl });
  const provisionReady = enabled && Boolean(parserApiKey) && Boolean(parserApiBaseUrl);

  let source = 'none';
  if (dbEnabled && dbParserUrl) source = 'database';
  else if (env.parserApiBaseUrl) source = 'env';
  else if (dbParserUrl) source = 'database';

  return {
    enabled,
    configured: provisionReady && Boolean(urls.crmWebhookUrl) && Boolean(webhookSecret),
    provisionReady,
    source,
    ...urls,
    hasParserApiKey: Boolean(parserApiKey),
    hasWebhookSecret: Boolean(webhookSecret),
    parserApiKey,
    webhookSecret
  };
}

async function getPublicInboundParserStatus() {
  const effective = await getEffectiveInboundParserConfig();
  return {
    inboundParserEnabled: effective.enabled,
    inboundParserConfigured: effective.configured,
    inboundParserProvisionReady: effective.provisionReady,
    inboundMode: 'inbound_parser',
    crmWebhookUrl: effective.crmWebhookUrl,
    parserProvisionUrl: effective.parserProvisionUrl
  };
}

function serializeAdminConfig(doc, effective) {
  const parserKeyNeedsResave =
    Boolean(doc.encryptedParserApiKey) && !effective.hasParserApiKey;
  const webhookSecretNeedsResave =
    Boolean(doc.encryptedWebhookSecret) && !effective.hasWebhookSecret;

  return {
    enabled: Boolean(doc.enabled),
    parserApiBaseUrl: doc.parserApiBaseUrl || '',
    crmPublicApiBaseUrl: doc.crmPublicApiBaseUrl || '',
    hasParserApiKey: Boolean(doc.encryptedParserApiKey) || effective.hasParserApiKey,
    hasWebhookSecret: Boolean(doc.encryptedWebhookSecret) || effective.hasWebhookSecret,
    parserKeyNeedsResave,
    webhookSecretNeedsResave,
    effective: {
      enabled: effective.enabled,
      configured: effective.configured,
      provisionReady: effective.provisionReady,
      source: effective.source,
      crmWebhookUrl: effective.crmWebhookUrl,
      parserProvisionUrl: effective.parserProvisionUrl,
      parserAdminMessageUrlTemplate: effective.parserAdminMessageUrlTemplate
    },
    envFallback: {
      parserApiBaseUrl: resolveFromEnv().parserApiBaseUrl,
      crmPublicApiBaseUrl: resolveFromEnv().crmPublicApiBaseUrl,
      hasParserApiKey: Boolean(resolveFromEnv().parserApiKey),
      hasWebhookSecret: Boolean(resolveFromEnv().webhookSecret)
    },
    parserEnvHint: {
      CRM_WEBHOOK_URL: effective.crmWebhookUrl,
      note: 'Set these on the Inbound Parser server (not visible to tenants).'
    }
  };
}

async function getAdminInboundParserConfig() {
  const doc = await loadConfigDoc();
  const effective = await getEffectiveInboundParserConfig();
  return serializeAdminConfig(doc, effective);
}

async function updateAdminInboundParserConfig({
  enabled,
  parserApiBaseUrl,
  crmPublicApiBaseUrl,
  parserApiKey,
  webhookSecret,
  updatedByUserId
}) {
  const updates = { updatedByUserId: updatedByUserId || null };

  if (enabled !== undefined) updates.enabled = Boolean(enabled);
  if (parserApiBaseUrl !== undefined) {
    updates.parserApiBaseUrl = normalizeBaseUrl(parserApiBaseUrl);
  }
  if (crmPublicApiBaseUrl !== undefined) {
    updates.crmPublicApiBaseUrl = normalizeBaseUrl(crmPublicApiBaseUrl);
  }
  if (parserApiKey !== undefined) {
    const trimmed = String(parserApiKey || '').trim();
    if (trimmed) updates.encryptedParserApiKey = encryptTenantSecret(trimmed);
  }
  if (webhookSecret !== undefined) {
    const trimmed = String(webhookSecret || '').trim();
    if (trimmed) updates.encryptedWebhookSecret = encryptTenantSecret(trimmed);
  }

  const doc = await PlatformInboundParserConfig.findByIdAndUpdate(
    CONFIG_ID,
    { $set: updates },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  const effective = await getEffectiveInboundParserConfig();
  return serializeAdminConfig(doc, effective);
}

async function testParserConnection() {
  const cfg = await getEffectiveInboundParserConfig();
  if (!cfg.parserApiBaseUrl) {
    return { ok: false, message: 'Parser API base URL is not configured' };
  }

  const healthUrl = `${cfg.parserApiBaseUrl}/health`;
  const provisionUrl = `${cfg.parserApiBaseUrl}/integrations/v1/mailboxes`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const healthRes = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
    if (!healthRes.ok) {
      clearTimeout(timeout);
      return {
        ok: false,
        message: `Parser health check failed (${healthRes.status}) at ${healthUrl}. Check URL and firewall between CRM and parser.`
      };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (cfg.parserApiKey) {
      headers.Authorization = `Bearer ${cfg.parserApiKey}`;
      headers['X-Arivu-Api-Key'] = cfg.parserApiKey;
    }

    const provisionRes = await fetch(provisionUrl, {
      method: 'POST',
      headers,
      body: '{}',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (provisionRes.status === 404) {
      return {
        ok: false,
        message:
          `Integrations API not found (404) at ${provisionUrl}. `
          + 'The Parser API base URL must be the prefix before /integrations/v1/... '
          + '(example: if the route is https://parser.example.com/api/integrations/v1/mailboxes, '
          + 'set base URL to https://parser.example.com/api). '
          + 'Also confirm the parser deployment includes the CRM provisioning API.'
      };
    }

    if ([400, 401, 409, 503].includes(provisionRes.status)) {
      return {
        ok: true,
        message:
          `Parser OK — health ${healthRes.status} at ${healthUrl}; `
          + `integrations API responded ${provisionRes.status} at ${provisionUrl} (expected for empty test body).`
      };
    }

    if (provisionRes.ok) {
      return {
        ok: true,
        message: `Parser OK — health and integrations API reachable at ${provisionUrl}.`
      };
    }

    return {
      ok: false,
      message:
        `Parser health OK at ${healthUrl}, but integrations API returned ${provisionRes.status} at ${provisionUrl}. Check parser logs and API key.`
    };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err?.name === 'AbortError' ? 'Connection timed out (12s)' : err?.message || String(err);
    return {
      ok: false,
      message: `Could not reach parser at ${cfg.parserApiBaseUrl}: ${msg}`
    };
  }
}

module.exports = {
  WEBHOOK_PATH,
  getEffectiveInboundParserConfig,
  getPublicInboundParserStatus,
  getAdminInboundParserConfig,
  updateAdminInboundParserConfig,
  testParserConnection,
  buildDerivedUrls
};
