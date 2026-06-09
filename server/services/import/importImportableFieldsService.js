const ModuleDefinition = require('../../models/ModuleDefinition');
const { normalizePeopleModuleFields } = require('../../utils/normalizePeopleModuleConfig');
const { SUPPORTED_MODULES } = require('./importConstants');

const IMPORT_MODULE_TO_DEFINITION_KEY = Object.freeze({
  contacts: 'people',
  deals: 'deals',
  tasks: 'tasks',
  organizations: 'organizations',
});

const IMPORT_EXCLUDED_KEYS = new Set([
  'participations',
  'activitylogs',
  'descriptionversions',
  'derivedstatus',
  'legacycontactid',
  'organizationid',
  'type',
]);

const GLOBAL_SYSTEM_FIELD_KEYS = new Set([
  'deletedat',
  'deletedby',
  'deletionreason',
  'source',
  'appointment',
]);

function normalizeFieldKey(fieldKey) {
  return String(fieldKey || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function isImportableField(field, moduleKey) {
  const key = field?.key;
  if (!key) return false;
  const norm = normalizeFieldKey(key);
  if (IMPORT_EXCLUDED_KEYS.has(norm)) return false;
  if (GLOBAL_SYSTEM_FIELD_KEYS.has(norm)) return false;
  if (field.isVisibleInConfig === false) return false;
  if (field.owner === 'system' && field.editable === false) return false;
  if (moduleKey === 'people' && norm === 'organizationid') return false;
  return true;
}

async function loadModuleFields(organizationId, definitionKey) {
  const moduleLower = String(definitionKey || '').toLowerCase();
  if (!moduleLower) return [];

  let fields = [];
  const tenant = await ModuleDefinition.findOne({
    organizationId,
    $or: [{ key: moduleLower }, { moduleKey: moduleLower }],
  })
    .select('fields')
    .lean();
  if (tenant?.fields?.length) {
    fields = tenant.fields;
  } else {
    const platform = await ModuleDefinition.findOne({
      appKey: 'SALES',
      moduleKey: moduleLower,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
    })
      .select('fields')
      .lean();
    fields = platform?.fields || [];
  }

  if (moduleLower === 'people') {
    fields = normalizePeopleModuleFields(fields);
  }

  return fields.filter((f) => isImportableField(f, moduleLower));
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} importModule contacts|deals|tasks|organizations
 * @returns {Promise<{ value: string, label: string }[]>}
 */
async function getImportableFieldsForModule(organizationId, importModule) {
  if (!SUPPORTED_MODULES.includes(importModule)) {
    return [];
  }
  const definitionKey = IMPORT_MODULE_TO_DEFINITION_KEY[importModule] || importModule;
  const fields = await loadModuleFields(organizationId, definitionKey);
  return fields.map((f) => ({
    value: f.key,
    label: typeof f.label === 'string' && f.label.trim() ? f.label.trim() : f.key,
  }));
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} importModule
 * @returns {Promise<Set<string>>}
 */
async function getImportableFieldKeySet(organizationId, importModule) {
  const fields = await getImportableFieldsForModule(organizationId, importModule);
  return new Set(fields.map((f) => f.value));
}

module.exports = {
  loadModuleFields,
  getImportableFieldsForModule,
  getImportableFieldKeySet,
  IMPORT_MODULE_TO_DEFINITION_KEY,
};
