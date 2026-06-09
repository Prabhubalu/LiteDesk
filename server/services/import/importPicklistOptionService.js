const mongoose = require('mongoose');
const {
  canEnsurePicklistOptionOnImport,
  findPicklistOptionByImportValue,
  buildPicklistOptionEntry,
  optionExists,
} = require('../../utils/picklistInlineOptionCreate');
const {
  loadModuleFields,
  IMPORT_MODULE_TO_DEFINITION_KEY,
} = require('./importImportableFieldsService');

function splitMultiPicklistRawValue(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((value) => String(value).trim()).filter(Boolean);
  }
  return String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildPicklistEnsureCacheKey(moduleKey, fieldKey, value) {
  return `${moduleKey}:${fieldKey}:${value}`.toLowerCase();
}

function buildFieldLookup(fields) {
  const byKey = new Map();
  for (const field of fields) {
    const key = String(field?.key || '').trim();
    if (!key) continue;
    byKey.set(key.toLowerCase(), field);
  }
  return byKey;
}

async function persistModulePicklistOptions(organizationId, moduleKey, fields) {
  const keyLower = String(moduleKey || '').toLowerCase();
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const orgFilterMongoose = {
    organizationId,
    $or: [{ key: keyLower }, { moduleKey: keyLower }],
  };

  const db = mongoose.connection.db;
  const collection = db.collection('moduledefinitions');
  await collection.updateOne(
    orgFilterMongoose,
    {
      $set: {
        fields,
        organizationId: orgObjectId,
        key: keyLower,
        moduleKey: keyLower,
        type: 'system',
        label: keyLower.charAt(0).toUpperCase() + keyLower.slice(1),
        pluralLabel: `${keyLower.charAt(0).toUpperCase()}${keyLower.slice(1)}s`,
        entityType: 'CORE',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string} importModule
 */
async function createImportPicklistContext(organizationId, importModule) {
  const definitionKey = IMPORT_MODULE_TO_DEFINITION_KEY[importModule] || importModule;
  const fields = await loadModuleFields(organizationId, definitionKey);
  return {
    organizationId,
    importModule,
    moduleKey: definitionKey,
    fields,
    fieldByKey: buildFieldLookup(fields),
    ensuredValues: new Set(),
  };
}

async function ensurePicklistValue({
  organizationId,
  moduleKey,
  fieldKey,
  rawValue,
  context,
}) {
  const field = context.fieldByKey.get(String(fieldKey).toLowerCase());
  if (!field) return rawValue;
  const existingStored = findPicklistOptionByImportValue(field.options, rawValue, fieldKey, moduleKey);
  if (existingStored) return existingStored;

  const cacheKey = buildPicklistEnsureCacheKey(moduleKey, fieldKey, rawValue);
  if (context.ensuredValues.has(cacheKey)) {
    const optionEntry = buildPicklistOptionEntry(rawValue, fieldKey, moduleKey, {
      existingOptions: field.options,
    });
    return optionEntry?.value || rawValue;
  }

  const optionEntry = buildPicklistOptionEntry(rawValue, fieldKey, moduleKey, {
    label: rawValue,
    existingOptions: field.options,
  });
  if (!optionEntry) return rawValue;
  if (optionExists(field.options, optionEntry.value)) {
    return findPicklistOptionByImportValue(field.options, rawValue, fieldKey, moduleKey) || optionEntry.value;
  }

  const fieldIdx = context.fields.findIndex(
    (candidate) => String(candidate?.key || '').toLowerCase() === String(fieldKey).toLowerCase()
  );
  if (fieldIdx < 0) return optionEntry.value;

  const currentField = context.fields[fieldIdx];
  const nextOptions = [...(Array.isArray(currentField.options) ? currentField.options : []), optionEntry];
  context.fields[fieldIdx] = {
    ...currentField,
    options: nextOptions,
  };
  context.fieldByKey.set(String(fieldKey).toLowerCase(), context.fields[fieldIdx]);

  await persistModulePicklistOptions(organizationId, moduleKey, context.fields);
  context.ensuredValues.add(cacheKey);
  return optionEntry.value;
}

/**
 * Ensure mapped picklist values exist in module field options and normalize row values.
 *
 * @param {object} params
 * @param {Record<string, string>} params.fieldMapping
 * @param {Record<string, unknown>} params.row
 * @param {Awaited<ReturnType<typeof createImportPicklistContext>>} params.picklistContext
 * @returns {Promise<Record<string, unknown>>}
 */
async function ensurePicklistOptionsForImportRow({
  fieldMapping,
  row,
  picklistContext,
}) {
  if (!picklistContext || !fieldMapping || !row) return row;

  const normalizedRow = { ...row };
  const { organizationId, moduleKey, fieldByKey } = picklistContext;

  for (const [csvField, mappedFieldKey] of Object.entries(fieldMapping)) {
    const rawCell = row[csvField];
    if (rawCell === undefined || rawCell === null || rawCell === '') continue;

    const field = fieldByKey.get(String(mappedFieldKey).toLowerCase());
    if (!field || !canEnsurePicklistOptionOnImport(moduleKey, field)) continue;

    const dataType = String(field.dataType || '');
    if (dataType === 'Multi-Picklist') {
      const parts = splitMultiPicklistRawValue(rawCell);
      const resolved = [];
      for (const part of parts) {
        resolved.push(await ensurePicklistValue({
          organizationId,
          moduleKey,
          fieldKey: mappedFieldKey,
          rawValue: part,
          context: picklistContext,
        }));
      }
      normalizedRow[csvField] = resolved.join(', ');
      continue;
    }

    normalizedRow[csvField] = await ensurePicklistValue({
      organizationId,
      moduleKey,
      fieldKey: mappedFieldKey,
      rawValue: rawCell,
      context: picklistContext,
    });
  }

  return normalizedRow;
}

module.exports = {
  createImportPicklistContext,
  ensurePicklistOptionsForImportRow,
  splitMultiPicklistRawValue,
};
