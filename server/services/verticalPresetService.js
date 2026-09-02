'use strict';

const ModuleDefinition = require('../models/ModuleDefinition');
const TenantModuleConfiguration = require('../models/TenantModuleConfiguration');
const Organization = require('../models/Organization');
const { getVerticalPreset } = require('./verticalPresets');
const {
  resolveVerticalTemplate,
  resolveTemplateByKey,
} = require('./onboardingVerticalTemplates');

const MODULE_APP_KEY = Object.freeze({
  people: 'SALES',
  organizations: 'SALES',
  deals: 'SALES',
  tasks: 'SALES',
  events: 'SALES',
  items: 'SALES',
  assignments: 'AUDIT',
});

const PRIMARY_MODULE_TO_LEGACY = Object.freeze({
  people: 'contacts',
  deals: 'deals',
  tasks: 'tasks',
  events: 'events',
  items: 'items',
  organizations: 'organizations',
  assignments: 'assignments',
});

const BASE_TRIAL_MODULES = Object.freeze(['contacts', 'deals', 'tasks', 'events']);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'stage';
}

function buildPipelineStage(name, { order = 0, probability = 0, status = 'open', keyPrefix = '' } = {}) {
  const normalizedStatus = ['open', 'won', 'lost'].includes(status) ? status : 'open';
  const keyBase = name || `Stage ${order + 1}`;
  const key = slugify(keyPrefix ? `${keyPrefix}_${keyBase}` : keyBase);
  const finalProbability = typeof probability === 'number'
    ? Math.min(100, Math.max(0, probability))
    : (normalizedStatus === 'won' ? 100 : 0);

  return {
    key,
    name: keyBase,
    description: '',
    probability: normalizedStatus === 'won' ? 100 : normalizedStatus === 'lost' ? 0 : finalProbability,
    status: normalizedStatus,
    order,
    isClosedWon: normalizedStatus === 'won',
    isClosedLost: normalizedStatus === 'lost',
    playbook: { actions: [], exitCriteria: { type: 'manual', customDescription: '', nextStageKey: '', conditions: [] } },
  };
}

function buildPipelineSettings(pipelineName, stages) {
  const now = new Date();
  const pipelineKey = slugify(pipelineName || 'default_pipeline');
  return [{
    key: pipelineKey,
    name: pipelineName || 'Default Pipeline',
    description: '',
    color: '#2563EB',
    isDefault: true,
    order: 0,
    createdAt: now,
    updatedAt: now,
    stages: (stages || []).map((stage, index) => buildPipelineStage(stage.name, {
      order: index,
      probability: stage.probability,
      status: stage.status || 'open',
      keyPrefix: pipelineKey,
    })),
  }];
}

function buildEnabledAppsArray(templateKey, { includeOptional = false } = {}) {
  const preset = getVerticalPreset(templateKey);
  const apps = [...(preset.enabledApps || ['SALES'])];
  if (includeOptional && Array.isArray(preset.optionalApps)) {
    apps.push(...preset.optionalApps);
  }
  const unique = [...new Set(apps.map((app) => String(app).toUpperCase()))];
  return unique.map((appKey) => ({
    appKey,
    status: 'ACTIVE',
    enabledAt: new Date(),
  }));
}

function resolveEnabledAppsForTemplate(templateKey, options = {}) {
  return buildEnabledAppsArray(templateKey, options).map((entry) => entry.appKey);
}

function resolveEnabledModulesFromTemplate(templateKey) {
  const template = resolveTemplateByKey(templateKey);
  const fromPrimary = (template.primaryModules || [])
    .map((moduleKey) => PRIMARY_MODULE_TO_LEGACY[moduleKey] || moduleKey)
    .filter(Boolean);
  return [...new Set([...BASE_TRIAL_MODULES, ...fromPrimary])];
}

function buildVerticalProvisionPreview(industry) {
  const template = resolveVerticalTemplate({ industry });
  const preset = getVerticalPreset(template.key);

  return {
    industry: String(industry || '').trim(),
    templateKey: template.key,
    primaryAppKey: template.primaryAppKey,
    primaryModules: template.primaryModules,
    emptyStateCopyKey: template.emptyStateCopyKey || null,
    enabledApps: resolveEnabledAppsForTemplate(template.key),
    optionalApps: preset.optionalApps || [],
    enabledModules: resolveEnabledModulesFromTemplate(template.key),
    moduleLabels: preset.moduleLabels || {},
    presetVersion: preset.version,
  };
}

async function findOrgModuleDefinition(organizationId, moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  return ModuleDefinition.findOne({
    organizationId,
    $or: [{ moduleKey: key }, { key }],
  });
}

function mergePresetFields(existingFields, presetFields) {
  const fields = Array.isArray(existingFields) ? [...existingFields] : [];
  const seen = new Set(fields.map((f) => String(f.key || '').toLowerCase()));

  for (const presetField of presetFields || []) {
    const fieldKey = String(presetField.key || '').toLowerCase();
    if (!fieldKey || seen.has(fieldKey)) continue;
    fields.push({ ...presetField, order: fields.length });
    seen.add(fieldKey);
  }

  return fields;
}

function picklistOptionsFromValues(values) {
  return (values || []).map((value) => ({ value, label: value }));
}

function applyStatusValuesToModule(moduleDef, statusValues) {
  if (!moduleDef || !Array.isArray(statusValues) || statusValues.length === 0) return;

  const fields = Array.isArray(moduleDef.fields) ? [...moduleDef.fields] : [];
  const statusKey = 'status';
  const existing = fields.find((f) => String(f.key || '').toLowerCase() === statusKey);

  if (existing) {
    existing.options = picklistOptionsFromValues(statusValues);
    existing.dataType = existing.dataType || 'Picklist';
  } else {
    fields.push({
      key: statusKey,
      label: 'Status',
      dataType: 'Picklist',
      required: false,
      options: picklistOptionsFromValues(statusValues),
      defaultValue: statusValues[0] || null,
      visibility: { list: true, detail: true },
      order: fields.length,
      owner: 'tenant',
      context: 'vertical_preset',
    });
  }

  moduleDef.fields = fields;
  moduleDef.lifecycle = moduleDef.lifecycle || {};
  moduleDef.lifecycle.statusField = statusKey;
  moduleDef.lifecycle.allowedStatuses = [...statusValues];
  moduleDef.markModified('fields');
  moduleDef.markModified('lifecycle');
}

async function applyModuleLabel(organizationId, moduleKey, labels) {
  if (!labels?.plural) return;

  const appKey = MODULE_APP_KEY[moduleKey] || 'SALES';
  const moduleDef = await findOrgModuleDefinition(organizationId, moduleKey);

  if (moduleDef) {
    moduleDef.name = labels.plural;
    if (labels.singular) {
      moduleDef.label = labels.singular;
    }
    if (labels.plural) {
      moduleDef.pluralLabel = labels.plural;
    }
    await moduleDef.save();
  }

  await TenantModuleConfiguration.findOneAndUpdate(
    { organizationId, appKey, moduleKey: String(moduleKey).toLowerCase() },
    { $set: { labelOverride: labels.plural } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function applyOrganizationTypes(organizationId, organizationTypes) {
  if (!Array.isArray(organizationTypes) || organizationTypes.length === 0) return;

  const rows = organizationTypes.map((type) => ({
    value: type,
    label: type,
    enabled: true,
  }));

  const existing = await TenantModuleConfiguration.findOne({
    organizationId,
    appKey: 'SALES',
    moduleKey: 'organizations',
  });

  const settings = existing?.settings && typeof existing.settings === 'object'
    ? { ...existing.settings }
    : {};
  const statusTypes = settings.statusTypes && typeof settings.statusTypes === 'object'
    ? { ...settings.statusTypes }
    : {};

  statusTypes.organizationTypes = rows;
  settings.statusTypes = statusTypes;

  await TenantModuleConfiguration.findOneAndUpdate(
    { organizationId, appKey: 'SALES', moduleKey: 'organizations' },
    { $set: { settings } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function applyModulePreset(organizationId, moduleKey, modulePreset) {
  if (!modulePreset) return;

  const moduleDef = await findOrgModuleDefinition(organizationId, moduleKey);

  if (moduleDef) {
    if (Array.isArray(modulePreset.customFields) && modulePreset.customFields.length > 0) {
      moduleDef.fields = mergePresetFields(moduleDef.fields, modulePreset.customFields);
      moduleDef.markModified('fields');
    }

    if (moduleKey === 'deals' && Array.isArray(modulePreset.pipelineStages) && modulePreset.pipelineStages.length > 0) {
      moduleDef.pipelineSettings = buildPipelineSettings(
        modulePreset.pipelineName || 'Sales Pipeline',
        modulePreset.pipelineStages,
      );
      moduleDef.markModified('pipelineSettings');
    }

    const statusValues = modulePreset.taskStatuses || modulePreset.eventStatuses;
    if (statusValues) {
      applyStatusValuesToModule(moduleDef, statusValues);
    }

    await moduleDef.save();
  } else if (modulePreset.taskStatuses || modulePreset.eventStatuses) {
    const appKey = MODULE_APP_KEY[moduleKey] || 'SALES';
    const statusValues = modulePreset.taskStatuses || modulePreset.eventStatuses;
    await TenantModuleConfiguration.findOneAndUpdate(
      { organizationId, appKey, moduleKey: String(moduleKey).toLowerCase() },
      {
        $set: {
          settings: {
            lifecycle: {
              allowedStatuses: statusValues,
            },
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  if (Array.isArray(modulePreset.organizationTypes)) {
    await applyOrganizationTypes(organizationId, modulePreset.organizationTypes);
  }
}

async function ensureBaseModulesInitialized(organizationId, preset, templateKey) {
  const template = resolveTemplateByKey(templateKey);
  const enabledApps = preset?.enabledApps || ['SALES'];
  const primaryModules = template.primaryModules || [];

  const needsSales = enabledApps.includes('SALES')
    || primaryModules.some((key) => MODULE_APP_KEY[key] === 'SALES')
    || Object.keys(preset?.modules || {}).some((key) => MODULE_APP_KEY[key] === 'SALES');

  const needsAudit = enabledApps.includes('AUDIT') || template.primaryAppKey === 'AUDIT';
  const needsItems = primaryModules.includes('items')
    || Object.prototype.hasOwnProperty.call(preset?.modules || {}, 'items');

  if (needsSales) {
    const salesAppInitializer = require('./salesAppInitializer');
    if (!(await salesAppInitializer.isSalesInitialized(organizationId))) {
      await salesAppInitializer.initializeSales(organizationId);
    }
  }

  if (needsAudit) {
    const auditAppInitializer = require('./auditAppInitializer');
    if (!(await auditAppInitializer.isAuditInitialized(organizationId))) {
      await auditAppInitializer.initializeAudit(organizationId);
    }
  }

  if (needsItems) {
    const itemsModuleInitializer = require('./itemsModuleInitializer');
    if (!(await itemsModuleInitializer.isItemsInitialized(organizationId))) {
      await itemsModuleInitializer.initializeItems(organizationId);
    }
  }
}

async function mirrorModuleDefinitionsToConnection(orgDbConnection, organizationId, getTenantModel) {
  const MasterModuleDefinition = require('../models/ModuleDefinition');
  const TenantModuleDefinition = getTenantModel(orgDbConnection, 'ModuleDefinition', MasterModuleDefinition);
  const definitions = await MasterModuleDefinition.find({ organizationId }).lean();

  for (const definition of definitions) {
    const payload = { ...definition };
    delete payload._id;
    await TenantModuleDefinition.findOneAndUpdate(
      { organizationId, moduleKey: definition.moduleKey || definition.key },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return definitions.length;
}

/**
 * Apply vertical preset pack (labels, fields, pipelines, org types) to a tenant org.
 * Idempotent — skips if same template version already applied.
 */
async function applyVerticalPresets(organizationId, templateKey, options = {}) {
  const { force = false } = options;
  const preset = getVerticalPreset(templateKey);
  if (!preset) {
    return { applied: false, templateKey, reason: 'unknown_template' };
  }

  const org = await Organization.findById(organizationId).select('settings industry').lean();
  if (!org) {
    return { applied: false, templateKey, reason: 'org_not_found' };
  }

  const applied = org.settings?.verticalPreset;
  if (!force && applied?.templateKey === templateKey && applied?.version >= preset.version) {
    return { applied: false, templateKey, reason: 'already_applied' };
  }

  await ensureBaseModulesInitialized(organizationId, preset, templateKey);

  for (const [moduleKey, labels] of Object.entries(preset.moduleLabels || {})) {
    await applyModuleLabel(organizationId, moduleKey, labels);
  }

  for (const [moduleKey, modulePreset] of Object.entries(preset.modules || {})) {
    await applyModulePreset(organizationId, moduleKey, modulePreset);
  }

  await Organization.findByIdAndUpdate(organizationId, {
    $set: {
      'settings.verticalPreset': {
        templateKey,
        version: preset.version,
        appliedAt: new Date(),
      },
    },
  });

  return { applied: true, templateKey, version: preset.version };
}

module.exports = {
  applyVerticalPresets,
  resolveEnabledAppsForTemplate,
  resolveEnabledModulesFromTemplate,
  buildEnabledAppsArray,
  buildVerticalProvisionPreview,
  buildPipelineSettings,
  mergePresetFields,
  mirrorModuleDefinitionsToConnection,
  PRIMARY_MODULE_TO_LEGACY,
};
