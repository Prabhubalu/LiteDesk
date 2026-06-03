/**
 * PAY3 — Gateway credential health checks.
 */

const OrganizationPaymentGatewaySettings = require('../models/OrganizationPaymentGatewaySettings');
const { GATEWAY_CREDENTIAL_HEALTH_DEFAULT } = require('../constants/paymentGatewayLifecycle');
const { getGatewayAdapter } = require('./gateways/gatewayAdapterRegistry');

async function getOrCreateSettings(organizationId) {
  let settings = await OrganizationPaymentGatewaySettings.findOne({ organizationId });
  if (!settings) {
    settings = await OrganizationPaymentGatewaySettings.create({ organizationId });
  }
  return settings;
}

async function updateProviderHealth(organizationId, provider, patch) {
  const settings = await getOrCreateSettings(organizationId);
  const current = settings.credentialHealth?.[provider]?.toObject?.() ||
    settings.credentialHealth?.[provider] ||
    {};

  settings.credentialHealth = settings.credentialHealth || {};
  settings.credentialHealth[provider] = {
    status: patch.status || current.status || GATEWAY_CREDENTIAL_HEALTH_DEFAULT,
    lastCheckedAt: patch.lastCheckedAt || new Date(),
    lastCheckError: patch.lastCheckError ?? current.lastCheckError ?? null,
    webhookReachable: patch.webhookReachable ?? current.webhookReachable ?? null
  };
  settings.markModified('credentialHealth');
  await settings.save();
  return settings.credentialHealth[provider];
}

async function checkProviderHealth({ organizationId, provider }) {
  const settings = await getOrCreateSettings(organizationId);

  if (provider === 'manual') {
    const { assertManualBankEnabled } = require('./bankTransferInstructionService');
    try {
      assertManualBankEnabled(settings.toObject());
      await updateProviderHealth(organizationId, provider, { status: 'healthy', lastCheckError: null });
      return { provider, status: 'healthy' };
    } catch (err) {
      await updateProviderHealth(organizationId, provider, { status: 'invalid', lastCheckError: err.message });
      return { provider, status: 'invalid', errorMessage: err.message };
    }
  }

  const adapter = getGatewayAdapter(provider);

  try {
    const result = await adapter.verifyCredentials({ organizationId, settings: settings.toObject() });
    const status = result.status || 'healthy';
    await updateProviderHealth(organizationId, provider, {
      status,
      lastCheckError: result.errorMessage || null
    });
    return { provider, status, errorMessage: result.errorMessage || null };
  } catch (err) {
    await updateProviderHealth(organizationId, provider, {
      status: 'invalid',
      lastCheckError: err.message
    });
    return { provider, status: 'invalid', errorMessage: err.message };
  }
}

async function assertProviderHealthy({ organizationId, provider }) {
  const settings = await getOrCreateSettings(organizationId);
  const enabled = settings.enabledProviders || [];

  if (!enabled.includes(provider)) {
    const err = new Error(`Gateway provider "${provider}" is not enabled for this organization`);
    err.code = 'GATEWAY_NOT_ENABLED';
    throw err;
  }

  const health = settings.credentialHealth?.[provider];
  const status = health?.status || GATEWAY_CREDENTIAL_HEALTH_DEFAULT;

  if (status === 'invalid') {
    const err = new Error(`Gateway credentials for ${provider} are invalid`);
    err.code = 'GATEWAY_CREDENTIALS_INVALID';
    throw err;
  }

  if (status === 'unknown') {
    const check = await checkProviderHealth({ organizationId, provider });
    if (check.status === 'invalid') {
      const err = new Error(`Gateway credentials for ${provider} are invalid`);
      err.code = 'GATEWAY_CREDENTIALS_INVALID';
      throw err;
    }
  }

  return settings;
}

async function getGatewayHealthSummary(organizationId) {
  const settings = await getOrCreateSettings(organizationId);
  return {
    enabledProviders: settings.enabledProviders || [],
    defaultProvider: settings.defaultProvider,
    credentialHealth: settings.credentialHealth || {}
  };
}

module.exports = {
  getOrCreateSettings,
  updateProviderHealth,
  checkProviderHealth,
  assertProviderHealthy,
  getGatewayHealthSummary
};
