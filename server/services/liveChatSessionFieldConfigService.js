'use strict';

const TenantAddonConfiguration = require('../models/TenantAddonConfiguration');
const { ADDON_KEYS } = require('../constants/addonKeys');
const {
  DEFAULT_COLUMN_KEYS,
  normalizeSessionColumnKeys,
  resolveEffectiveColumnKeys,
  buildFieldMetadataResponse,
  listFieldsForViewer,
} = require('../constants/liveChatSessionFieldRegistry');

function readSessionFieldsSettings(tenantConfig) {
  const sessionFields = tenantConfig?.settings?.sessionFields || {};
  return {
    defaultColumns: Array.isArray(sessionFields.defaultColumns) ? sessionFields.defaultColumns : [],
    advancedEnabled: sessionFields.advancedEnabled === true,
  };
}

async function getTenantLiveChatConfig(organizationId) {
  return TenantAddonConfiguration.findOne({
    organizationId,
    addonKey: ADDON_KEYS.LIVE_CHAT,
    archivedAt: { $in: [null, undefined] },
  });
}

async function getSessionFieldConfigForViewer({ organizationId, isAdmin = false }) {
  const tenantConfig = await getTenantLiveChatConfig(organizationId);
  const settings = readSessionFieldsSettings(tenantConfig);
  const fields = buildFieldMetadataResponse({
    advancedEnabled: settings.advancedEnabled,
    isAdmin,
  });
  const defaultColumnKeys = resolveEffectiveColumnKeys({
    tenantDefaultColumns: settings.defaultColumns,
    advancedEnabled: settings.advancedEnabled,
    isAdmin,
  });

  return {
    fields,
    config: {
      defaultColumns: defaultColumnKeys,
      advancedEnabled: settings.advancedEnabled,
      tenantDefaultColumns: settings.defaultColumns,
    },
    defaultColumnKeys,
  };
}

async function updateSessionFieldSettings(organizationId, payload = {}) {
  const tenantConfig = await getTenantLiveChatConfig(organizationId);
  if (!tenantConfig) {
    const err = new Error('Live Chat addon is not installed');
    err.statusCode = 404;
    err.code = 'ADDON_NOT_INSTALLED';
    throw err;
  }

  const current = readSessionFieldsSettings(tenantConfig);
  const advancedEnabled = payload.advancedEnabled != null
    ? payload.advancedEnabled === true
    : current.advancedEnabled;

  const allowedFields = listFieldsForViewer({ advancedEnabled, isAdmin: true });
  const allowedKeys = new Set(allowedFields.map((field) => field.key));

  let defaultColumns = current.defaultColumns;
  if (payload.defaultColumns != null) {
    defaultColumns = normalizeSessionColumnKeys(payload.defaultColumns, { allowedKeys });
    if (!defaultColumns.length) {
      const err = new Error('At least one valid column is required');
      err.statusCode = 400;
      throw err;
    }
  }

  tenantConfig.settings = {
    ...(tenantConfig.settings || {}),
    sessionFields: {
      defaultColumns,
      advancedEnabled,
    },
  };
  await tenantConfig.save();

  return getSessionFieldConfigForViewer({ organizationId, isAdmin: true });
}

module.exports = {
  getSessionFieldConfigForViewer,
  updateSessionFieldSettings,
  readSessionFieldsSettings,
};
