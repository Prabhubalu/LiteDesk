const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const {
  STANDARD_LIVE_CHAT_OUTCOMES,
  STANDARD_OUTCOME_KEYS,
  normalizeOutcomeKey,
} = require('../constants/liveChatOutcomes');

function sanitizeCustomOutcomes(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(STANDARD_OUTCOME_KEYS);
  const out = [];

  for (const row of raw) {
    const key = normalizeOutcomeKey(row?.key || row?.label);
    const label = String(row?.label || key || '').trim().slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, system: false });
  }

  return out;
}

async function getTenantLiveChatConfig(organizationId) {
  return TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.LIVE_CHAT,
  });
}

async function listOutcomesForOrganization(organizationId) {
  const config = await getTenantLiveChatConfig(organizationId);
  const custom = sanitizeCustomOutcomes(config?.settings?.outcomes?.custom);
  return [...STANDARD_LIVE_CHAT_OUTCOMES, ...custom];
}

async function updateCustomOutcomes(organizationId, customOutcomes) {
  const config = await getTenantLiveChatConfig(organizationId);
  if (!config) {
    const err = new Error('Live Chat addon is not installed');
    err.statusCode = 404;
    err.code = 'ADDON_NOT_INSTALLED';
    throw err;
  }

  const custom = sanitizeCustomOutcomes(customOutcomes);
  config.settings = {
    ...(config.settings || {}),
    outcomes: {
      ...(config.settings?.outcomes || {}),
      custom,
    },
  };
  await config.save();

  return listOutcomesForOrganization(organizationId);
}

async function isValidOutcomeForOrganization(organizationId, outcomeKey) {
  const normalized = normalizeOutcomeKey(outcomeKey);
  if (!normalized) return false;
  const outcomes = await listOutcomesForOrganization(organizationId);
  return outcomes.some((row) => row.key === normalized);
}

module.exports = {
  listOutcomesForOrganization,
  updateCustomOutcomes,
  isValidOutcomeForOrganization,
  sanitizeCustomOutcomes,
  normalizeOutcomeKey,
};
