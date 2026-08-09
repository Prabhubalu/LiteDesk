'use strict';

const TelephonyProviderConfig = require('../../models/TelephonyProviderConfig');
const TwilioAdapter = require('./providers/twilio/TwilioAdapter');
const ExotelAdapter = require('./providers/exotel/ExotelAdapter');
const PlivoAdapter = require('./providers/plivo/PlivoAdapter');
const KnowlarityAdapter = require('./providers/knowlarity/KnowlarityAdapter');
const GenericSipAdapter = require('./providers/genericSip/GenericSipAdapter');
const { UnsupportedProviderCapabilityError } = require('./providers/TelephonyProvider');

const ADAPTERS = {
  twilio: TwilioAdapter,
  exotel: ExotelAdapter,
  plivo: PlivoAdapter,
  knowlarity: KnowlarityAdapter,
  generic_sip: GenericSipAdapter,
};

/**
 * @param {string} providerKey
 * @param {Object} config
 */
function createAdapter(providerKey, config = {}) {
  const key = String(providerKey || '').trim().toLowerCase();
  const AdapterClass = ADAPTERS[key];
  if (!AdapterClass) {
    throw new UnsupportedProviderCapabilityError(
      'createAdapter',
      key || 'unknown',
      `No telephony adapter registered for provider "${key}"`
    );
  }
  return new AdapterClass({ ...config, providerKey: key });
}

/**
 * Load active provider config for org and return adapter.
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 */
async function getProviderForOrganization(organizationId) {
  if (!organizationId) return null;
  const config = await TelephonyProviderConfig.findOne({
    organizationId,
    isActive: true,
    enabled: { $ne: false },
  }).lean();
  if (!config) return null;
  return createAdapter(config.providerKey, config);
}

/**
 * Resolve org + adapter from provider external account id (e.g. Twilio AccountSid).
 * @param {string} accountSid
 */
async function getProviderByExternalAccountId(accountSid) {
  const externalAccountId = String(accountSid || '').trim();
  if (!externalAccountId) return null;
  const config = await TelephonyProviderConfig.findOne({
    externalAccountId,
    enabled: { $ne: false },
  }).lean();
  if (!config) return null;
  return {
    config,
    adapter: createAdapter(config.providerKey, config),
    organizationId: config.organizationId,
  };
}

function listRegisteredProviders() {
  return Object.keys(ADAPTERS);
}

module.exports = {
  createAdapter,
  getProviderForOrganization,
  getProviderByExternalAccountId,
  listRegisteredProviders,
  ADAPTERS,
};
