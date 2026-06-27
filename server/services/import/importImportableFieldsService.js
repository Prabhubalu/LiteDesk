const ModuleDefinition = require('../../models/ModuleDefinition');
const { getBaseFieldsForKey } = require('../../controllers/moduleController');
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
  if (field.isTenantField === true) return false;
  if (field.owner === 'system' && field.editable === false) return false;
  if (moduleKey === 'people' && norm === 'organizationid') return false;
  return true;
}

function resolvePlatformAppKey(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'deals') return 'sales';
  return 'platform';
}

/** Align import field resolution with module API: saved overrides + missing schema base fields. */
function mergeSavedFieldsWithBase(baseFields, savedFields) {
  if (!Array.isArray(savedFields) || savedFields.length === 0) {
    return Array.isArray(baseFields) ? [...baseFields] : [];
  }
  const seen = new Set(
    savedFields.map((field) => String(field?.key || '').trim().toLowerCase()).filter(Boolean)
  );
  const merged = [...savedFields];
  for (const baseField of baseFields || []) {
    const key = String(baseField?.key || '').trim();
    if (!key) continue;
    if (!seen.has(key.toLowerCase())) {
      merged.push(baseField);
    }
  }
  return merged;
}

async function loadModuleFields(organizationId, definitionKey) {
  const moduleLower = String(definitionKey || '').toLowerCase();
  if (!moduleLower) return [];

  const baseFields = getBaseFieldsForKey(moduleLower) || [];
  let savedFields = [];

  const tenant = await ModuleDefinition.findOne({
    organizationId,
    $or: [{ key: moduleLower }, { moduleKey: moduleLower }],
  })
    .select('fields')
    .lean();

  if (Array.isArray(tenant?.fields) && tenant.fields.length > 0) {
    savedFields = tenant.fields;
  } else {
    const platform = await ModuleDefinition.findOne({
      appKey: resolvePlatformAppKey(moduleLower),
      moduleKey: moduleLower,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
    })
      .select('fields')
      .lean();
    if (Array.isArray(platform?.fields) && platform.fields.length > 0) {
      savedFields = platform.fields;
    }
  }

  let fields = mergeSavedFieldsWithBase(baseFields, savedFields);

  if (moduleLower === 'people') {
    fields = normalizePeopleModuleFields(fields);
  }

  return fields.filter((field) => isImportableField(field, moduleLower));
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
  mergeSavedFieldsWithBase,
  resolvePlatformAppKey,
  isImportableField,
  IMPORT_MODULE_TO_DEFINITION_KEY,
};
