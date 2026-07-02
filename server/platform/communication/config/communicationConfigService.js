const CommunicationConfig = require('../../../models/CommunicationConfig');
const { SUPPORTED_MODULES } = require('../domain/sendEmailContract');
const { encryptTenantSecret, decryptTenantSecret } = require('../../../utils/tenantSecretCrypto');

const DEFAULT_GMAIL_PUBLIC = Object.freeze({
  clientId: '',
  redirectUri: '',
  hasClientSecret: false
});

const DEFAULT_CONFIG = Object.freeze({
  outboundEmail: {
    enabled: true,
    requireIdempotencyKey: false,
    maxRecipientsPerMessage: 50,
    allowedModuleKeys: Array.from(SUPPORTED_MODULES),
    allowWorkspaceEmail: true,
    disallowPlatformSmtpForWorkspace: false,
    requireMailboxProviderForAgentSend: false,
    suppression: {
      autoSuppressOnBounce: true,
      autoSuppressOnComplaint: true
    }
  },
  gmailInboxSync: DEFAULT_GMAIL_PUBLIC
});

function normalizeAllowedModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return Array.from(SUPPORTED_MODULES);
  }
  const normalized = modules
    .map((m) => String(m || '').trim().toLowerCase())
    .filter((m) => SUPPORTED_MODULES.has(m));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : Array.from(SUPPORTED_MODULES);
}

function normalizeSuppressionConfig(input = {}) {
  return {
    autoSuppressOnBounce: input.autoSuppressOnBounce !== false,
    autoSuppressOnComplaint: input.autoSuppressOnComplaint !== false
  };
}

function publicGmailInboxSyncFromDoc(configDoc) {
  const g = configDoc?.gmailInboxSync || {};
  return {
    clientId: String(g.clientId || '').trim(),
    redirectUri: String(g.redirectUri || '').trim(),
    hasClientSecret: Boolean(g.clientSecretEnc)
  };
}

/**
 * Google OAuth **Web client** credentials for Gmail API (token exchange + authorize URL).
 * Tenant DB values override environment when present.
 */
async function getGmailOAuthAppCredentialsForServer(organizationId) {
  if (!organizationId) {
    return {
      error:
        'Gmail isn’t enabled on this workspace yet. Ask your LiteDesk administrator to set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI on the API server (typical for SaaS—users then only click Connect Gmail).'
    };
  }
  const doc = await CommunicationConfig.findOne({ organizationId }).select('gmailInboxSync').lean();
  const g = doc?.gmailInboxSync || {};
  let clientSecret = '';
  if (g.clientSecretEnc) {
    clientSecret = decryptTenantSecret(g.clientSecretEnc);
  }
  if (!clientSecret) {
    clientSecret = String(process.env.GOOGLE_GMAIL_CLIENT_SECRET || '').trim();
  }
  const clientId = String(g.clientId || process.env.GOOGLE_GMAIL_CLIENT_ID || '').trim();
  const redirectUri = String(g.redirectUri || process.env.GOOGLE_GMAIL_REDIRECT_URI || '').trim();
  if (!clientId || !clientSecret || !redirectUri) {
    const envFallbackSecret = String(process.env.GOOGLE_GMAIL_CLIENT_SECRET || '').trim();
    const storedSecretUndecryptable =
      Boolean(g.clientSecretEnc) && !clientSecret && !envFallbackSecret;
    return {
      error: storedSecretUndecryptable
        ? 'Gmail OAuth client secret was saved but cannot be decrypted (MAILBOX_OAUTH_SECRET or JWT_SECRET likely changed). Re-enter it under Settings → Integrations → Email → Advanced (custom Google OAuth app), or set GOOGLE_GMAIL_CLIENT_SECRET on the server.'
        : 'Gmail isn’t enabled on this API server yet. Ask your administrator to set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, and GOOGLE_GMAIL_REDIRECT_URI once (hosted deployments). Self-hosted workspace owners can optionally add overrides under Settings → Integrations → Email → Advanced.'
    };
  }
  return { clientId, clientSecret, redirectUri };
}

function buildCommunicationConfigFromDoc(configDoc) {
  if (!configDoc) {
    return { ...DEFAULT_CONFIG, gmailInboxSync: { ...DEFAULT_GMAIL_PUBLIC } };
  }

  const maxRecipientsRaw = Number(configDoc?.outboundEmail?.maxRecipientsPerMessage);
  const maxRecipientsPerMessage = Number.isFinite(maxRecipientsRaw) && maxRecipientsRaw > 0
    ? Math.min(1000, Math.max(1, maxRecipientsRaw))
    : DEFAULT_CONFIG.outboundEmail.maxRecipientsPerMessage;

  return {
    outboundEmail: {
      enabled: configDoc?.outboundEmail?.enabled !== false,
      requireIdempotencyKey: configDoc?.outboundEmail?.requireIdempotencyKey === true,
      maxRecipientsPerMessage,
      allowedModuleKeys: normalizeAllowedModules(configDoc?.outboundEmail?.allowedModuleKeys),
      allowWorkspaceEmail: configDoc?.outboundEmail?.allowWorkspaceEmail !== false,
      disallowPlatformSmtpForWorkspace:
        configDoc?.outboundEmail?.disallowPlatformSmtpForWorkspace === true,
      requireMailboxProviderForAgentSend:
        configDoc?.outboundEmail?.requireMailboxProviderForAgentSend === true,
      suppression: normalizeSuppressionConfig(configDoc?.outboundEmail?.suppression || {})
    },
    gmailInboxSync: publicGmailInboxSyncFromDoc(configDoc)
  };
}

function isGmailOAuthAppConfiguredFromDoc(configDoc) {
  const g = configDoc?.gmailInboxSync || {};
  let clientSecret = '';
  if (g.clientSecretEnc) {
    clientSecret = decryptTenantSecret(g.clientSecretEnc);
  }
  if (!clientSecret) {
    clientSecret = String(process.env.GOOGLE_GMAIL_CLIENT_SECRET || '').trim();
  }
  const clientId = String(g.clientId || process.env.GOOGLE_GMAIL_CLIENT_ID || '').trim();
  const redirectUri = String(g.redirectUri || process.env.GOOGLE_GMAIL_REDIRECT_URI || '').trim();
  return Boolean(clientId && clientSecret && redirectUri);
}

const POLICY_BUNDLE_CACHE_TTL_MS = 30_000;
/** @type {Map<string, { expiresAt: number, value: { communicationConfig: object, gmailOAuthAppConfigured: boolean } }>} */
const policyBundleCache = new Map();

function invalidateEmailIntegrationPolicyCache(organizationId) {
  if (organizationId) {
    policyBundleCache.delete(String(organizationId));
  }
}

async function getEmailIntegrationPolicyBundleForOrganization(organizationId) {
  if (!organizationId) {
    return {
      communicationConfig: { ...DEFAULT_CONFIG, gmailInboxSync: { ...DEFAULT_GMAIL_PUBLIC } },
      gmailOAuthAppConfigured: false
    };
  }
  const cacheKey = String(organizationId);
  const cached = policyBundleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const configDoc = await CommunicationConfig.findOne({ organizationId }).lean();
  const value = {
    communicationConfig: buildCommunicationConfigFromDoc(configDoc),
    gmailOAuthAppConfigured: isGmailOAuthAppConfiguredFromDoc(configDoc)
  };
  policyBundleCache.set(cacheKey, {
    expiresAt: Date.now() + POLICY_BUNDLE_CACHE_TTL_MS,
    value
  });
  return value;
}

async function getCommunicationConfigForOrganization(organizationId) {
  if (!organizationId) {
    return { ...DEFAULT_CONFIG, gmailInboxSync: { ...DEFAULT_GMAIL_PUBLIC } };
  }
  const configDoc = await CommunicationConfig.findOne({ organizationId }).lean();
  return buildCommunicationConfigFromDoc(configDoc);
}

async function upsertCommunicationConfigForOrganization(organizationId, policyInput = {}) {
  if (!organizationId) {
    return {
      outboundEmail: { ...DEFAULT_CONFIG.outboundEmail },
      gmailInboxSync: { ...DEFAULT_GMAIL_PUBLIC }
    };
  }
  const outboundInput = policyInput.outboundEmail || {};
  const maxRecipientsRaw = Number(outboundInput.maxRecipientsPerMessage);
  const maxRecipientsPerMessage = Number.isFinite(maxRecipientsRaw) && maxRecipientsRaw > 0
    ? Math.min(1000, Math.max(1, Math.floor(maxRecipientsRaw)))
    : DEFAULT_CONFIG.outboundEmail.maxRecipientsPerMessage;

  const update = {
    outboundEmail: {
      enabled: outboundInput.enabled !== false,
      requireIdempotencyKey: outboundInput.requireIdempotencyKey === true,
      maxRecipientsPerMessage,
      allowedModuleKeys: normalizeAllowedModules(outboundInput.allowedModuleKeys),
      allowWorkspaceEmail: outboundInput.allowWorkspaceEmail !== false,
      disallowPlatformSmtpForWorkspace: outboundInput.disallowPlatformSmtpForWorkspace === true,
      requireMailboxProviderForAgentSend:
        outboundInput.requireMailboxProviderForAgentSend === true,
      suppression: normalizeSuppressionConfig(outboundInput.suppression || {})
    }
  };

  const gmailInput = policyInput.gmailInboxSync;
  if (gmailInput && typeof gmailInput === 'object') {
    const existing = await CommunicationConfig.findOne({ organizationId }).lean();
    const prevG = existing?.gmailInboxSync || {};
    const nextG = {
      clientId: gmailInput.clientId !== undefined
        ? String(gmailInput.clientId || '').trim()
        : String(prevG.clientId || '').trim(),
      redirectUri: gmailInput.redirectUri !== undefined
        ? String(gmailInput.redirectUri || '').trim()
        : String(prevG.redirectUri || '').trim(),
      clientSecretEnc: prevG.clientSecretEnc || ''
    };
    if (gmailInput.clientSecret !== undefined && String(gmailInput.clientSecret).trim() !== '') {
      nextG.clientSecretEnc = encryptTenantSecret(String(gmailInput.clientSecret).trim());
    }
    update.gmailInboxSync = nextG;
  }

  await CommunicationConfig.findOneAndUpdate(
    { organizationId },
    { $set: update, $setOnInsert: { organizationId } },
    { upsert: true, new: true, runValidators: true }
  );

  invalidateEmailIntegrationPolicyCache(organizationId);

  return getCommunicationConfigForOrganization(organizationId);
}

module.exports = {
  getCommunicationConfigForOrganization,
  getEmailIntegrationPolicyBundleForOrganization,
  upsertCommunicationConfigForOrganization,
  invalidateEmailIntegrationPolicyCache,
  getGmailOAuthAppCredentialsForServer,
  DEFAULT_CONFIG
};
