'use strict';

/**
 * Merge tenant/platform module field config with system base fields for webform runtime.
 * Mirrors the core listModules merge (Settings → module fields + base schema dependencies).
 */

const ModuleDefinition = require('../models/ModuleDefinition');
const { normalizePeopleModuleFields } = require('../utils/normalizePeopleModuleConfig');
const { getPeopleTypesConfig } = require('../utils/tenantMetadata');
const {
  getBaseFieldsForKey,
  getPeopleVirtualBaseFields
} = require('../controllers/moduleController');

function fieldKeyCanonical(key) {
  return String(key || '').toLowerCase().trim().replace(/\s+/g, '').replace(/-/g, '');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSavedFieldWithBase(savedField, baseField) {
  if (!savedField?.key || !baseField) return savedField;

  savedField.dataType = baseField.dataType || savedField.dataType || savedField.type;

  const hasSavedDeps = Array.isArray(savedField.dependencies) && savedField.dependencies.length > 0;
  if (
    !hasSavedDeps
    && Array.isArray(baseField.dependencies)
    && baseField.dependencies.length > 0
  ) {
    savedField.dependencies = cloneJson(baseField.dependencies);
  }

  const savedOptions = Array.isArray(savedField.options) ? savedField.options : [];
  if (savedOptions.length === 0 && Array.isArray(baseField.options) && baseField.options.length > 0) {
    savedField.options = cloneJson(baseField.options);
  }

  if (savedField.required === undefined) {
    savedField.required = baseField.required;
  }

  if (baseField.label) {
    const savedLabel = String(savedField.label || '').trim();
    const keyNorm = String(savedField.key || '').replace(/\s+/g, '').toLowerCase();
    const labelNorm = savedLabel.replace(/\s+/g, '').toLowerCase();
    if (!savedLabel || labelNorm === keyNorm) {
      savedField.label = baseField.label;
    }
  }

  if (baseField.lookupSettings && !savedField.lookupSettings) {
    savedField.lookupSettings = baseField.lookupSettings;
  }

  if (savedField.key.toLowerCase() === baseField.key.toLowerCase() && savedField.key !== baseField.key) {
    savedField.key = baseField.key;
  }

  return savedField;
}

function mergeSavedModuleFieldsWithBase(moduleKey, baseFields, savedFields) {
  const key = String(moduleKey || '').toLowerCase();
  let base = cloneJson(Array.isArray(baseFields) ? baseFields : []);

  if (key === 'people') {
    base = [...base, ...getPeopleVirtualBaseFields()];
  }

  if (!Array.isArray(savedFields) || savedFields.length === 0) {
    return key === 'people' ? normalizePeopleModuleFields(base) : base;
  }

  const saved = cloneJson(savedFields);
  const baseFieldMap = new Map();
  const baseFieldMapCanonical = new Map();

  for (const field of base) {
    if (!field?.key) continue;
    baseFieldMap.set(field.key, field);
    baseFieldMapCanonical.set(fieldKeyCanonical(field.key), field);
  }

  for (const savedField of saved) {
    if (!savedField?.key) continue;
    let baseField = baseFieldMap.get(savedField.key);
    if (!baseField) {
      baseField = baseFieldMapCanonical.get(fieldKeyCanonical(savedField.key));
    }
    if (baseField) {
      mergeSavedFieldWithBase(savedField, baseField);
    }
  }

  const savedCanonicalKeys = new Set(
    saved.map((field) => fieldKeyCanonical(field.key)).filter(Boolean)
  );

  for (const baseField of base) {
    if (!baseField?.key) continue;
    if (savedCanonicalKeys.has(fieldKeyCanonical(baseField.key))) continue;
    saved.push({ ...cloneJson(baseField), order: saved.length });
  }

  if (key === 'people') {
    return normalizePeopleModuleFields(saved);
  }

  return saved;
}

async function loadModuleOverrideFields(organizationId, moduleKey, appKey) {
  const key = String(moduleKey || '').toLowerCase().trim();
  if (!key) return null;

  const orgMod = await ModuleDefinition.findOne({
    organizationId,
    $or: [{ key }, { moduleKey: key }]
  })
    .select('fields')
    .lean();

  if (Array.isArray(orgMod?.fields) && orgMod.fields.length > 0) {
    return orgMod.fields;
  }

  const resolvedAppKey = String(appKey || 'PLATFORM').toUpperCase();
  const platformAppKey = resolvedAppKey === 'PLATFORM' ? 'platform' : resolvedAppKey.toLowerCase();

  const platformMod = await ModuleDefinition.findOne({
    organizationId: null,
    appKey: platformAppKey,
    moduleKey: key
  })
    .select('fields')
    .lean();

  if (Array.isArray(platformMod?.fields) && platformMod.fields.length > 0) {
    return platformMod.fields;
  }

  if (platformAppKey !== 'platform') {
    const platformCore = await ModuleDefinition.findOne({
      organizationId: null,
      appKey: 'platform',
      moduleKey: key
    })
      .select('fields')
      .lean();
    if (Array.isArray(platformCore?.fields) && platformCore.fields.length > 0) {
      return platformCore.fields;
    }
  }

  return null;
}

async function getMergedModuleFieldsForWebform(organizationId, moduleKey, appKey = null) {
  const key = String(moduleKey || '').toLowerCase().trim();
  if (!key || !organizationId) return [];

  const baseFields = getBaseFieldsForKey(key);
  const overrideFields = await loadModuleOverrideFields(organizationId, key, appKey);
  let fields = mergeSavedModuleFieldsWithBase(key, baseFields, overrideFields);

  if (key === 'people') {
    const peopleCfg = await getPeopleTypesConfig(organizationId, 'SALES');
    const { typeDefsToPeopleTypePicklistOptions } = require('../utils/tenantMetadata');
    const options = typeDefsToPeopleTypePicklistOptions(Array.isArray(peopleCfg?.typeDefs) ? peopleCfg.typeDefs : []);
    fields = fields.map((field) => {
      const fieldKey = String(field?.key || '').trim().toLowerCase();
      if (fieldKey === 'sales_type') return { ...field, options };
      return field;
    });
  }

  return fields;
}

module.exports = {
  fieldKeyCanonical,
  mergeSavedModuleFieldsWithBase,
  getMergedModuleFieldsForWebform
};
