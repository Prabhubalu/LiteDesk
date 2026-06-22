const crypto = require('crypto');
const Organization = require('../models/Organization');
const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const { isAddonEntitledForOrg } = require('../utils/addonAccessUtils');

const {
  normalizeConsentMessage,
  normalizePolicyUrl,
  normalizeConsentRequired,
  DEFAULT_CONSENT_MESSAGE,
} = require('../constants/liveChatSessionCompliance');

const DEFAULT_WELCOME_MESSAGE =
  "Hey! Let's discuss how we can help you. Fill out the form to start chatting.";

const DEFAULT_CAPTURE_FIELDS = ['name', 'email'];

function normalizeCaptureFields(value) {
  if (!Array.isArray(value)) return [...DEFAULT_CAPTURE_FIELDS];
  return value.map((v) => String(v || '').trim()).filter(Boolean);
}

async function getTenantLiveChatConfig(organizationId) {
  return TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.LIVE_CHAT,
  });
}

async function ensureEmbedPublicKey(organizationId) {
  const org = await Organization.findById(organizationId).select('embed.chat.publicKey').lean();
  if (org?.embed?.chat?.publicKey) {
    return org.embed.chat.publicKey;
  }

  const publicKey = `inst_chat_${crypto.randomBytes(16).toString('hex')}`;
  await Organization.updateOne(
    { _id: organizationId },
    {
      $set: {
        'embed.chat.publicKey': publicKey,
        'embed.chat.enabled': true,
      },
    },
  );
  return publicKey;
}

async function syncOrganizationEmbed(organizationId, widgetSettings, widgetEnabled) {
  const setFields = {
    'embed.chat.enabled': widgetEnabled === true,
  };

  if (widgetSettings?.captureFields) {
    setFields['embed.chat.config.captureFields'] = widgetSettings.captureFields;
  }
  if (widgetSettings?.welcomeMessage != null) {
    setFields['embed.chat.config.welcomeMessage'] = widgetSettings.welcomeMessage;
  }

  await Organization.updateOne({ _id: organizationId }, { $set: setFields });
}

/**
 * Widget settings for tenant admin UI + embed runtime.
 */
async function getWidgetSettings(organizationId) {
  const org = await Organization.findById(organizationId).select('embed.chat').lean();
  const tenantConfig = await getTenantLiveChatConfig(organizationId);
  const widget = tenantConfig?.settings?.widget || {};
  const orgConfig = org?.embed?.chat?.config || {};

  const widgetEnabled =
    tenantConfig?.enabled !== false
    && widget.enabled !== false
    && org?.embed?.chat?.enabled === true;

  return {
    addonInstalled: !!tenantConfig,
    widgetEnabled,
    publicKey: org?.embed?.chat?.publicKey || null,
    captureFields: normalizeCaptureFields(widget.captureFields ?? orgConfig.captureFields),
    welcomeMessage:
      String(widget.welcomeMessage || orgConfig.welcomeMessage || DEFAULT_WELCOME_MESSAGE).trim(),
    consentRequired: normalizeConsentRequired(widget.consentRequired),
    consentMessage: normalizeConsentMessage(widget.consentMessage),
    privacyPolicyUrl: normalizePolicyUrl(widget.privacyPolicyUrl),
    termsUrl: normalizePolicyUrl(widget.termsUrl),
  };
}

async function updateWidgetSettings(organizationId, payload = {}) {
  const tenantConfig = await getTenantLiveChatConfig(organizationId);
  if (!tenantConfig) {
    const err = new Error('Live Chat addon is not installed');
    err.statusCode = 404;
    err.code = 'ADDON_NOT_INSTALLED';
    throw err;
  }

  const currentWidget = tenantConfig.settings?.widget || {};
  const captureFields = payload.captureFields != null
    ? normalizeCaptureFields(payload.captureFields)
    : normalizeCaptureFields(currentWidget.captureFields);
  const welcomeMessage = payload.welcomeMessage != null
    ? String(payload.welcomeMessage || '').trim() || DEFAULT_WELCOME_MESSAGE
    : String(currentWidget.welcomeMessage || DEFAULT_WELCOME_MESSAGE).trim();
  const widgetEnabled = payload.widgetEnabled !== false;
  const consentRequired = payload.consentRequired != null
    ? normalizeConsentRequired(payload.consentRequired)
    : normalizeConsentRequired(currentWidget.consentRequired);
  const consentMessage = payload.consentMessage != null
    ? normalizeConsentMessage(payload.consentMessage)
    : normalizeConsentMessage(currentWidget.consentMessage);
  const privacyPolicyUrl = payload.privacyPolicyUrl != null
    ? normalizePolicyUrl(payload.privacyPolicyUrl)
    : normalizePolicyUrl(currentWidget.privacyPolicyUrl);
  const termsUrl = payload.termsUrl != null
    ? normalizePolicyUrl(payload.termsUrl)
    : normalizePolicyUrl(currentWidget.termsUrl);

  tenantConfig.settings = {
    ...(tenantConfig.settings || {}),
    widget: {
      ...currentWidget,
      enabled: widgetEnabled,
      captureFields,
      welcomeMessage,
      consentRequired,
      consentMessage,
      privacyPolicyUrl,
      termsUrl,
    },
  };
  await tenantConfig.save();

  const publicKey = await ensureEmbedPublicKey(organizationId);
  await syncOrganizationEmbed(
    organizationId,
    { captureFields, welcomeMessage },
    widgetEnabled,
  );

  const settings = await getWidgetSettings(organizationId);
  return { ...settings, publicKey };
}

/**
 * Resolve org + widget for public embed routes (instance key lookup).
 */
async function resolvePublicEmbedContext(instanceKey) {
  const trimmedKey = String(instanceKey || '').trim();
  if (!trimmedKey) return null;

  const org = await Organization.findOne({
    'embed.chat.publicKey': trimmedKey,
  }).lean();
  if (!org) return null;

  const entitled = await isAddonEntitledForOrg(org._id, ADDON_KEYS.LIVE_CHAT);
  if (!entitled) return null;

  const widget = await getWidgetSettings(org._id);
  if (!widget.widgetEnabled) return null;

  return { organization: org, widget };
}

module.exports = {
  DEFAULT_WELCOME_MESSAGE,
  DEFAULT_CONSENT_MESSAGE,
  ensureEmbedPublicKey,
  getWidgetSettings,
  updateWidgetSettings,
  resolvePublicEmbedContext,
};
