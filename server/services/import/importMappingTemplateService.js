const ImportFieldMappingTemplate = require('../../models/ImportFieldMappingTemplate');
const { SUPPORTED_MODULES } = require('./importConstants');
const {
  applyImportMappingTemplate,
  buildColumnRulesFromFieldMapping,
  validateImportFieldMapping,
  detectCrossRuleAliasCollisions,
  dedupeColumnRuleAliases,
} = require('../../utils/importMappingTemplateUtils');
const {
  getImportableFieldsForModule,
  getImportableFieldKeySet,
} = require('./importImportableFieldsService');

function assertSupportedModule(module) {
  if (!SUPPORTED_MODULES.includes(module)) {
    const error = new Error(`Unsupported import module: ${module}`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeColumnRules(columnRules, allowedKeys = null) {
  if (!Array.isArray(columnRules) || columnRules.length === 0) {
    const error = new Error('columnRules must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  const normalized = dedupeColumnRuleAliases(columnRules);

  if (normalized.length === 0) {
    const error = new Error('Each column rule needs a target field and at least one source alias');
    error.statusCode = 400;
    throw error;
  }

  const collisions = detectCrossRuleAliasCollisions(normalized);
  if (collisions.length) {
    const detail = collisions
      .map((c) => `${c.normalizedAlias} → ${c.targetFieldKeys.join(', ')}`)
      .join('; ');
    const error = new Error(
      `Duplicate source aliases map to different fields: ${detail}`
    );
    error.statusCode = 400;
    error.code = 'IMPORT_MAPPING_ALIAS_COLLISION';
    throw error;
  }

  if (allowedKeys) {
    for (const rule of normalized) {
      if (!allowedKeys.has(rule.targetFieldKey)) {
        const error = new Error(`Unknown or non-importable field: ${rule.targetFieldKey}`);
        error.statusCode = 400;
        throw error;
      }
    }
  }

  return normalized;
}

async function recordTemplateUsage(organizationId, templateId) {
  await ImportFieldMappingTemplate.findOneAndUpdate(
    { _id: templateId, organizationId },
    {
      $inc: { 'stats.useCount': 1 },
      $set: { 'stats.lastUsedAt': new Date() },
    }
  );
}

async function clearDefaultForModule(organizationId, module, exceptId = null) {
  const query = {
    organizationId,
    module,
    isDefault: true,
  };
  if (exceptId) {
    query._id = { $ne: exceptId };
  }
  await ImportFieldMappingTemplate.updateMany(query, { $set: { isDefault: false } });
}

async function listTemplates(organizationId, module) {
  if (module) assertSupportedModule(module);
  const query = { organizationId };
  if (module) query.module = module;
  const templates = await ImportFieldMappingTemplate.find(query)
    .sort({ isDefault: -1, 'stats.lastUsedAt': -1, updatedAt: -1 })
    .lean();
  return templates;
}

async function getTemplateById(organizationId, templateId) {
  const template = await ImportFieldMappingTemplate.findOne({
    _id: templateId,
    organizationId,
  }).lean();
  if (!template) {
    const error = new Error('Import mapping template not found');
    error.statusCode = 404;
    throw error;
  }
  return template;
}

async function createTemplate({
  organizationId,
  userId,
  module,
  name,
  description,
  columnRules,
  isDefault,
  duplicatePolicy,
  sampleSourceHeaders,
}) {
  assertSupportedModule(module);
  const allowedKeys = await getImportableFieldKeySet(organizationId, module);
  const normalizedRules = normalizeColumnRules(columnRules, allowedKeys);

  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    const error = new Error('Template name is required');
    error.statusCode = 400;
    throw error;
  }

  if (isDefault) {
    await clearDefaultForModule(organizationId, module);
  }

  const template = await ImportFieldMappingTemplate.create({
    organizationId,
    module,
    name: trimmedName,
    description: String(description || '').trim(),
    columnRules: normalizedRules,
    isDefault: !!isDefault,
    duplicatePolicy: duplicatePolicy || null,
    sampleSourceHeaders: Array.isArray(sampleSourceHeaders) ? sampleSourceHeaders : [],
    createdBy: userId,
    modifiedBy: userId,
  });

  return template.toObject();
}

async function updateTemplate({
  organizationId,
  userId,
  templateId,
  name,
  description,
  columnRules,
  isDefault,
  duplicatePolicy,
}) {
  const existing = await ImportFieldMappingTemplate.findOne({
    _id: templateId,
    organizationId,
  });
  if (!existing) {
    const error = new Error('Import mapping template not found');
    error.statusCode = 404;
    throw error;
  }

  if (name !== undefined) existing.name = String(name || '').trim();
  if (description !== undefined) existing.description = String(description || '').trim();

  if (columnRules !== undefined) {
    const allowedKeys = await getImportableFieldKeySet(organizationId, existing.module);
    existing.columnRules = normalizeColumnRules(columnRules, allowedKeys);
  }

  if (duplicatePolicy !== undefined) {
    existing.duplicatePolicy = duplicatePolicy;
  }

  if (isDefault === true) {
    await clearDefaultForModule(organizationId, existing.module, existing._id);
    existing.isDefault = true;
  } else if (isDefault === false) {
    existing.isDefault = false;
  }

  existing.modifiedBy = userId;
  await existing.save();
  return existing.toObject();
}

async function deleteTemplate(organizationId, templateId) {
  const result = await ImportFieldMappingTemplate.findOneAndDelete({
    _id: templateId,
    organizationId,
  });
  if (!result) {
    const error = new Error('Import mapping template not found');
    error.statusCode = 404;
    throw error;
  }
  return result;
}

async function applyTemplate({
  organizationId,
  templateId,
  csvHeaders,
  trackUsage = true,
}) {
  const template = await getTemplateById(organizationId, templateId);
  const fields = await getImportableFieldsForModule(organizationId, template.module);
  const headers = Array.isArray(csvHeaders) ? csvHeaders.map((h) => String(h || '').trim()).filter(Boolean) : [];

  if (!headers.length) {
    const error = new Error('csvHeaders must be a non-empty array');
    error.statusCode = 400;
    throw error;
  }

  const { fieldMapping, report } = applyImportMappingTemplate(
    headers,
    template.columnRules,
    fields
  );

  if (trackUsage) {
    await recordTemplateUsage(organizationId, templateId);
  }

  return {
    fieldMapping,
    report,
    duplicatePolicy: template.duplicatePolicy || null,
    template: {
      _id: template._id,
      name: template.name,
      module: template.module,
    },
  };
}

async function validateFieldMappingForImport(organizationId, module, fieldMapping) {
  const allowedKeys = await getImportableFieldKeySet(organizationId, module);
  return validateImportFieldMapping(fieldMapping, allowedKeys);
}

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  recordTemplateUsage,
  validateFieldMappingForImport,
  buildColumnRulesFromFieldMapping,
};
