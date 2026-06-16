'use strict';

const ModuleDefinition = require('../../models/ModuleDefinition');
const TenantModuleConfiguration = require('../../models/TenantModuleConfiguration');
const { getEnabledAppsForTenant, getEnabledModulesForApp } = require('../../utils/tenantMetadata');
const { listAdapters } = require('./slaModuleRegistry');
const { CASE_TYPES, CASE_PRIORITIES, CASE_CHANNELS, CASE_STATUSES } = require('../../constants/caseLifecycle');

const EXCLUDED_FIELD_KEYS = new Set([
  '_id',
  'activitylogs',
  'activitylogs',
  'customfields',
  'deletedat',
  'deletedby',
  'deletionreason',
  'descriptionversions',
  'participations'
]);

const SUPPORTED_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'currency',
  'percent',
  'date',
  'datetime',
  'picklist',
  'multi-picklist',
  'boolean',
  'email',
  'phone',
  'url',
  'lookup'
]);

const ASSIGNMENT_EXTRA_FIELD_TYPES = new Set([
  'array',
  'multiselect',
  'reference',
  'user',
  'lookup-user'
]);

function normalizeFieldDataType(raw) {
  const src = String(raw || '').trim();
  if (!src) return 'text';
  const lower = src.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
  if (lower === 'text-area' || lower === 'textarea') return 'textarea';
  if (lower === 'multi-picklist' || lower === 'multi-pick-list') return 'multi-picklist';
  if (lower === 'pick-list') return 'picklist';
  if (lower === 'multi-select' || lower === 'multiselect') return 'multiselect';
  if (lower === 'date-time' || lower === 'date-time-local') return 'datetime';
  if (lower === 'bool') return 'boolean';
  if (lower === 'user' || lower === 'users') return 'user';
  if (lower === 'lookup-user' || lower === 'user-lookup') return 'lookup-user';
  if (lower === 'ref' || lower === 'objectid' || lower === 'object-id') return 'reference';
  return lower;
}

async function listTenantSlaModules(organizationId) {
  const modules = [];
  const seen = new Set();

  for (const adapter of listAdapters()) {
    const moduleKey = String(adapter.moduleKey || '').toLowerCase();
    if (!moduleKey || seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    modules.push({
      moduleKey,
      appKey: adapter.appKey || null,
        label: adapter.labelKey || moduleKey,
        labelKey: adapter.labelKey || null
    });
  }

  try {
    const apps = await getEnabledAppsForTenant(organizationId);
    for (const app of apps) {
      const enabled = await getEnabledModulesForApp(organizationId, app.appKey);
      for (const mod of enabled) {
        const moduleKey = String(mod.moduleKey || '').toLowerCase();
        if (!moduleKey || seen.has(moduleKey)) continue;
        seen.add(moduleKey);
        modules.push({
          moduleKey,
          appKey: mod.appKey || app.appKey,
          label: mod.labelOverride || mod.pluralLabel || moduleKey
        });
      }
    }

    // Fallback: some tenants may not have TenantAppConfiguration seeded,
    // but TenantModuleConfiguration still exists (enabled modules in sidebar).
    // Include those so the UI can select other modules.
    const tenantModules = await TenantModuleConfiguration.find({
      organizationId,
      enabled: true
    })
      .select('moduleKey appKey labelOverride')
      .lean()
      .catch(() => []);

    for (const mod of tenantModules) {
      const moduleKey = String(mod?.moduleKey || '').toLowerCase();
      if (!moduleKey || seen.has(moduleKey)) continue;
      seen.add(moduleKey);
      modules.push({
        moduleKey,
        appKey: mod?.appKey || null,
        label: mod?.labelOverride || moduleKey
      });
    }

    // Final fallback: platform modules (when tenant app/module configs are missing).
    // This makes the module picker usable even before full tenant seeding.
    if (modules.length <= 1) {
      const platformModules = await ModuleDefinition.find({
        enabled: true,
        $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
      })
        .select('moduleKey appKey label pluralLabel')
        .lean()
        .catch(() => []);

      for (const mod of platformModules) {
        const moduleKey = String(mod?.moduleKey || '').toLowerCase();
        if (!moduleKey || seen.has(moduleKey)) continue;
        seen.add(moduleKey);
        modules.push({
          moduleKey,
          appKey: mod?.appKey ? String(mod.appKey).toUpperCase() : null,
          label: mod?.pluralLabel || mod?.label || moduleKey
        });
      }
    }
  } catch (error) {
    console.error('[slaModuleMetadataService] listTenantSlaModules', error);
  }

  return modules.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function loadModuleDefinitionFields(organizationId, appKey, moduleKey, options = {}) {
  const includeHidden = options.includeHidden === true;
  const forAssignment = options.forAssignment === true;
  const allowedTypes = forAssignment
    ? new Set([...SUPPORTED_FIELD_TYPES, ...ASSIGNMENT_EXTRA_FIELD_TYPES])
    : SUPPORTED_FIELD_TYPES;
  const normApp = String(appKey || '').toLowerCase();
  const normMod = String(moduleKey || '').toLowerCase();
  if (!normApp || !normMod) return [];

  let moduleDef = null;
  if (organizationId) {
    moduleDef = await ModuleDefinition.findOne({
      organizationId,
      $or: [
        { key: normMod, appKey: normApp },
        { moduleKey: normMod, appKey: normApp }
      ]
    })
      .select('fields')
      .lean();
  }

  if (!moduleDef?.fields?.length) {
    moduleDef = await ModuleDefinition.findOne({
      appKey: normApp,
      moduleKey: normMod,
      $or: [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ]
    })
      .select('fields')
      .lean();
  }

  const rawFields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
  return rawFields
    .filter((field) => {
      const key = String(field?.key || '').trim();
      if (!key) return false;
      if (EXCLUDED_FIELD_KEYS.has(key.toLowerCase())) return false;
      const dataType = normalizeFieldDataType(field?.dataType || 'text');
      if (!includeHidden && !['picklist', 'multi-picklist'].includes(dataType)) {
        if (field?.visibility?.detail === false && field?.visibility?.list === false) return false;
      }
      return allowedTypes.has(dataType);
    })
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      dataType: normalizeFieldDataType(field.dataType || 'text'),
      options: Array.isArray(field.options) ? field.options : []
    }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function getSlaModuleConditionFields(organizationId, appKey, moduleKey) {
  const fields = await loadModuleDefinitionFields(organizationId, appKey, moduleKey);
  if (fields.length > 0) return fields;

  if (String(moduleKey).toLowerCase() === 'cases') {
    return [
      { key: 'priority', label: 'Priority', dataType: 'picklist', options: CASE_PRIORITIES.map((value) => ({ value })) },
      { key: 'caseType', label: 'Case type', dataType: 'picklist', options: CASE_TYPES.map((value) => ({ value })) },
      { key: 'channel', label: 'Channel', dataType: 'picklist', options: CASE_CHANNELS.map((value) => ({ value })) },
      { key: 'status', label: 'Status', dataType: 'picklist', options: CASE_STATUSES.map((value) => ({ value })) }
    ];
  }

  return [
    { key: 'status', label: 'Status', dataType: 'picklist' },
    { key: 'priority', label: 'Priority', dataType: 'picklist' }
  ];
}

async function resolveModuleAppKey(organizationId, moduleKey, appKey = null) {
  if (appKey) return String(appKey).toUpperCase();
  const modules = await listTenantSlaModules(organizationId);
  const match = modules.find((row) => row.moduleKey === String(moduleKey || '').toLowerCase());
  return match?.appKey ? String(match.appKey).toUpperCase() : null;
}

module.exports = {
  listTenantSlaModules,
  getSlaModuleConditionFields,
  loadModuleDefinitionFields,
  resolveModuleAppKey
};
