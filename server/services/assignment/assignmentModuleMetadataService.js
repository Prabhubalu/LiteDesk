'use strict';

const {
  listTenantSlaModules,
  loadModuleDefinitionFields,
  resolveModuleAppKey
} = require('../sla/slaModuleMetadataService');
const { listAdapters } = require('./assignmentModuleRegistry');
const { buildAssignmentRulesMetadata } = require('../../constants/assignmentRules');
const {
  getSupplementalAssignmentConditionFields,
  mergeConditionFields
} = require('../../constants/assignmentConditionFields');
const { isAddonEntitledForOrg } = require('../../utils/addonAccessUtils');

const ADDON_GATED_ASSIGNMENT_MODULES = {
  live_chat_sessions: 'live_chat',
};

async function listTenantAssignmentModules(organizationId) {
  const modules = await listTenantSlaModules(organizationId);
  const seen = new Set(modules.map((row) => row.moduleKey));
  for (const adapter of listAdapters()) {
    const moduleKey = String(adapter.moduleKey || '').toLowerCase();
    if (!moduleKey || seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    modules.push({
      moduleKey,
      appKey: adapter.appKey || null,
      label: adapter.labelKey || moduleKey,
      labelKey: adapter.labelKey || null,
    });
  }

  const filtered = [];
  for (const mod of modules) {
    const addonKey = ADDON_GATED_ASSIGNMENT_MODULES[mod.moduleKey];
    if (addonKey) {
      const entitled = await isAddonEntitledForOrg(organizationId, addonKey);
      if (!entitled) continue;
    }
    filtered.push(mod);
  }

  return filtered.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function getAssignmentModuleConditionFields(organizationId, appKey, moduleKey) {
  const mk = String(moduleKey || '').toLowerCase();
  const resolvedAppKey = appKey
    ? String(appKey).toUpperCase()
    : await resolveModuleAppKey(organizationId, mk, null);
  const normApp = (resolvedAppKey || appKey || '').toString().toLowerCase();

  const definitionFields = normApp && mk
    ? await loadModuleDefinitionFields(organizationId, normApp, mk, {
      includeHidden: true,
      forAssignment: true
    })
    : [];
  const supplemental = getSupplementalAssignmentConditionFields(resolvedAppKey || appKey, mk);

  const merged = mergeConditionFields(definitionFields, supplemental);

  // Expose tenant custom fields stored under customFields.* for condition paths.
  const customFieldRows = definitionFields
    .filter((row) => String(row.key || '').startsWith('customFields.'))
    .map((row) => ({
      key: row.key,
      label: row.label || row.key.replace(/^customFields\./, ''),
      dataType: row.dataType || 'text',
      options: row.options || []
    }));

  return mergeConditionFields(merged, customFieldRows);
}

module.exports = {
  buildAssignmentRulesMetadata,
  listTenantAssignmentModules,
  getAssignmentModuleConditionFields,
  resolveModuleAppKey
};
