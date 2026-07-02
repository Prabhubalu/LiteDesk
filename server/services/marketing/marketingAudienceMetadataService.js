'use strict';

const mongoose = require('mongoose');
const ModuleDefinition = require('../../models/ModuleDefinition');
const Organization = require('../../models/Organization');
const TenantModuleConfiguration = require('../../models/TenantModuleConfiguration');
const RelationshipDefinition = require('../../models/RelationshipDefinition');
const { getEnabledAppsForTenant, getEnabledModulesForApp } = require('../../utils/tenantMetadata');
const { loadModuleDefinitionFields } = require('../sla/slaModuleMetadataService');
const {
  MAX_RELATIONSHIP_DEPTH,
  PREVIEW_SAMPLE_MAX,
  RECIPIENT_RESOLVE_MAX,
  AUDIENCE_PRIMARY_MODULE_KEYS,
  DATA_TYPE_TO_FILTER_TYPE,
  MARKETING_EXCLUDED_FIELD_KEYS,
  OPERATORS_BY_FILTER_TYPE
} = require('./marketingAudienceConstants');
const { inferForeignKeyOnChild } = require('./marketingAudienceForeignKeys');
const { RECORD_SOURCE_VALUES } = require('../../constants/recordSource');

function normalizeModuleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFilterOptions(rawOptions = []) {
  if (!Array.isArray(rawOptions)) return [];
  return rawOptions
    .map((opt) => {
      if (typeof opt === 'string') {
        const value = opt.trim();
        return value ? { value, label: value } : null;
      }
      const value = String(opt?.value ?? opt?.label ?? '').trim();
      if (!value) return null;
      const label = String(opt?.label ?? opt?.value ?? value).trim() || value;
      return { value, label };
    })
    .filter(Boolean);
}

function normalizeMarketingFieldDataType(raw) {
  const src = String(raw || '').trim().toLowerCase();
  if (!src) return 'text';
  if (src.includes('checkbox') || src === 'bool' || src === 'boolean') return 'boolean';
  if (src.includes('integer') || src.includes('decimal') || src.includes('number')) return 'number';
  if (src.includes('currency')) return 'currency';
  if (src.includes('percent')) return 'percent';
  if (src.includes('date') && src.includes('time')) return 'datetime';
  if (src.includes('date')) return 'date';
  if (src.includes('radio') || src.includes('picklist') || src.includes('pick-list')) return 'picklist';
  if (src.includes('multi')) return 'multi-picklist';
  if (src.includes('lookup') && src.includes('user')) return 'lookup-user';
  if (src.includes('lookup') && src.includes('relationship')) return 'reference';
  if (src.includes('lookup')) return 'lookup';
  if (src.includes('user')) return 'user';
  if (src.includes('email')) return 'email';
  if (src.includes('phone')) return 'phone';
  if (src.includes('url')) return 'url';
  if (src.includes('text area') || src === 'textarea') return 'textarea';
  if (src.includes('text')) return 'text';
  return src.replace(/\s+/g, '-').replace(/[()]/g, '');
}

const MARKETING_USER_FIELD_KEYS = new Set([
  'assignedto',
  'lead_owner',
  'createdby',
  'modifiedby',
  'owner',
  'enabledby',
  'disabledby'
]);

function resolveMarketingFilterType(field) {
  const key = String(field?.key || '').trim().toLowerCase();
  if (MARKETING_USER_FIELD_KEYS.has(key)) return 'user';
  const targetModule = String(field?.lookupSettings?.targetModule || '').toLowerCase();
  if (targetModule === 'users' || targetModule === 'user') return 'user';
  return normalizeMarketingFieldDataType(field?.dataType);
}

function isMarketingFilterableField(field) {
  const key = String(field?.key || '').trim();
  if (!key || key.includes('.')) return false;
  const normKey = key.toLowerCase();
  if (MARKETING_EXCLUDED_FIELD_KEYS.has(normKey)) return false;
  const dataType = resolveMarketingFilterType(field);
  return Boolean(DATA_TYPE_TO_FILTER_TYPE[dataType]);
}

function mergeRelationshipEdge(edges, graph, seenEdgeKeys, edge) {
  const dedupeKey = `${edge.fromModuleKey}:${edge.relationshipKey}`;
  if (!seenEdgeKeys.has(dedupeKey)) {
    seenEdgeKeys.add(dedupeKey);
    edges.push(edge);
  }
  if (!graph[edge.fromModuleKey]) graph[edge.fromModuleKey] = [];
  if (!graph[edge.fromModuleKey].includes(edge.relationshipKey)) {
    graph[edge.fromModuleKey].push(edge.relationshipKey);
  }
}

async function buildExpandedRelationshipMetadata(
  organizationId,
  primaryModuleKey,
  platformDefs,
  maxDepth = MAX_RELATIONSHIP_DEPTH
) {
  const edges = [];
  const graph = {};
  const seenEdgeKeys = new Set();
  const moduleKeys = new Set([normalizeModuleKey(primaryModuleKey)]);
  const processed = new Set();
  let frontier = [normalizeModuleKey(primaryModuleKey)];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
    const nextFrontier = [];
    for (const moduleKey of frontier) {
      if (processed.has(moduleKey)) continue;
      processed.add(moduleKey);

      const appKey = await resolveModuleAppKey(organizationId, moduleKey);
      const { edges: moduleEdges } = await buildRelationshipGraphForModule(
        organizationId,
        appKey,
        moduleKey,
        platformDefs
      );

      for (const edge of moduleEdges) {
        mergeRelationshipEdge(edges, graph, seenEdgeKeys, edge);
        moduleKeys.add(edge.toModuleKey);
        nextFrontier.push(edge.toModuleKey);
      }
    }
    frontier = [...new Set(nextFrontier)];
  }

  return { edges, graph, moduleKeys };
}

function mapFieldToFilterConfig(field) {
  const dataType = resolveMarketingFilterType(field);
  const filterType = DATA_TYPE_TO_FILTER_TYPE[dataType] || 'text';
  return {
    key: field.key,
    label: field.label || field.key,
    filterType,
    fieldPath: field.key,
    operators: OPERATORS_BY_FILTER_TYPE[filterType] || ['is'],
    options: normalizeFilterOptions(field.options)
  };
}

function mapHintTypeToCardinality(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'many_to_one') return 'MANY_TO_ONE';
  if (normalized === 'one_to_many') return 'ONE_TO_MANY';
  return 'MANY_TO_MANY';
}

async function resolveModuleAppKey(organizationId, moduleKey) {
  const normMod = normalizeModuleKey(moduleKey);
  const apps = await getEnabledAppsForTenant(organizationId);
  for (const app of apps) {
    const modules = await getEnabledModulesForApp(organizationId, app.appKey);
    if (modules.some((row) => normalizeModuleKey(row.moduleKey) === normMod)) {
      return String(app.appKey || '').toLowerCase();
    }
  }
  if (normMod === 'people' || normMod === 'organizations' || normMod === 'deals') return 'sales';
  if (normMod === 'cases') return 'helpdesk';
  if (normMod === 'tasks' || normMod === 'events') return 'platform';
  return 'sales';
}

async function loadModuleDefinitionRelationships(organizationId, appKey, moduleKey) {
  const normMod = normalizeModuleKey(moduleKey);
  if (!normMod) return [];

  if (organizationId) {
    const tenantModuleDef = await ModuleDefinition.findOne({
      organizationId,
      moduleKey: normMod
    })
      .select('relationships')
      .lean();
    if (tenantModuleDef?.relationships?.length) {
      return tenantModuleDef.relationships;
    }
  }

  const appKeysToTry = new Set(
    [appKey, await resolveModuleAppKey(organizationId, normMod), 'platform', 'sales', 'helpdesk']
      .map((value) => String(value || '').toLowerCase())
      .filter(Boolean)
  );

  for (const normApp of appKeysToTry) {
    const moduleDef = await ModuleDefinition.findOne({
      appKey: normApp,
      moduleKey: normMod,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    })
      .select('relationships')
      .lean();
    if (moduleDef?.relationships?.length) {
      return moduleDef.relationships;
    }
  }

  return [];
}

async function loadPlatformRelationshipDefinitions() {
  return RelationshipDefinition.find({ enabled: { $ne: false } })
    .select(
      'relationshipKey source target cardinality ownership localField foreignField constraints automation userLinkable ui'
    )
    .lean();
}

function buildRelationshipEdge(def, perspectiveModuleKey, moduleRelationshipHints) {
  const relKey = String(def.relationshipKey || '').toLowerCase();
  const sourceMod = normalizeModuleKey(def.source?.moduleKey);
  const targetMod = normalizeModuleKey(def.target?.moduleKey);
  const perspective = normalizeModuleKey(perspectiveModuleKey);

  const hintFromSource = (moduleRelationshipHints || []).find(
    (row) => String(row.relationshipKey || '').toLowerCase() === relKey
  );

  if (perspective === sourceMod) {
    const localField =
      def.localField ||
      hintFromSource?.localField ||
      inferForeignKeyOnChild(perspective, targetMod) ||
      null;
    return {
      relationshipKey: relKey,
      label:
        hintFromSource?.label ||
        hintFromSource?.name ||
        def.ui?.target?.label ||
        targetMod,
      fromModuleKey: sourceMod,
      toModuleKey: targetMod,
      direction: 'forward',
      sourceAppKey: String(def.source?.appKey || '').toLowerCase(),
      targetAppKey: String(def.target?.appKey || '').toLowerCase(),
      cardinality: def.cardinality,
      localField,
      foreignField: def.foreignField || hintFromSource?.foreignField || '_id',
      isLookup: hintFromSource?.isLookup === true,
      linkKinds: [
        'relationship_instance',
        ...(localField || inferForeignKeyOnChild(targetMod, perspective) ? ['foreign_key'] : [])
      ]
    };
  }

  if (perspective === targetMod) {
    const reverseLocalField =
      def.localField ||
      hintFromSource?.localField ||
      inferForeignKeyOnChild(sourceMod, perspective) ||
      null;
    return {
      relationshipKey: relKey,
      label: def.ui?.source?.label || sourceMod,
      fromModuleKey: targetMod,
      toModuleKey: sourceMod,
      direction: 'reverse',
      sourceAppKey: String(def.target?.appKey || '').toLowerCase(),
      targetAppKey: String(def.source?.appKey || '').toLowerCase(),
      cardinality: def.cardinality,
      localField: null,
      foreignField: def.foreignField || '_id',
      reverseSourceModuleKey: sourceMod,
      reverseLocalField,
      linkKinds: ['relationship_instance', 'reverse_foreign_key']
    };
  }

  return null;
}

async function appendEdgesFromModuleHints(organizationId, perspectiveModuleKey, appKey, hints, edges) {
  const perspective = normalizeModuleKey(perspectiveModuleKey);
  for (const hint of hints) {
    const relKey = String(hint.relationshipKey || '').toLowerCase();
    const targetMod = normalizeModuleKey(hint.targetModuleKey);
    if (!relKey || !targetMod) continue;
    if (edges.some((row) => row.relationshipKey === relKey && row.fromModuleKey === perspective)) {
      continue;
    }

    const targetAppKey = await resolveModuleAppKey(organizationId, targetMod);
    const forwardFk = hint.isLookup ? hint.localField || inferForeignKeyOnChild(perspective, targetMod) : null;
    const reverseFk = inferForeignKeyOnChild(targetMod, perspective);
    edges.push({
      relationshipKey: relKey,
      label: hint.label || hint.name || targetMod,
      fromModuleKey: perspective,
      toModuleKey: targetMod,
      direction: 'forward',
      sourceAppKey: String(appKey || '').toLowerCase(),
      targetAppKey,
      cardinality: mapHintTypeToCardinality(hint.type),
      localField: forwardFk,
      foreignField: hint.foreignField || '_id',
      isLookup: hint.isLookup === true,
      linkKinds: ['relationship_instance', ...(forwardFk || reverseFk ? ['foreign_key'] : [])]
    });
  }
}

async function buildRelationshipGraphForModule(organizationId, appKey, moduleKey, platformDefs) {
  const normMod = normalizeModuleKey(moduleKey);
  const hints = await loadModuleDefinitionRelationships(organizationId, appKey, normMod);
  const edges = [];

  for (const def of platformDefs) {
    if (def.automation?.allowed === false) continue;
    const edge = buildRelationshipEdge(def, normMod, hints);
    if (edge) edges.push(edge);
  }

  await appendEdgesFromModuleHints(organizationId, normMod, appKey, hints, edges);

  const graph = {};
  for (const edge of edges) {
    if (!graph[edge.fromModuleKey]) graph[edge.fromModuleKey] = [];
    graph[edge.fromModuleKey].push(edge.relationshipKey);
  }

  return { edges, graph };
}

async function getOrganizationEnabledAppKeys(organizationId) {
  const org = await Organization.findById(organizationId).select('enabledApps').lean();
  return new Set(
    (org?.enabledApps || [])
      .filter((row) => String(row.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .map((row) => String(row.appKey || '').toLowerCase())
      .filter(Boolean)
  );
}

function isAudienceModuleAvailableForOrg(moduleKey, moduleAppKey, enabledAppKeys) {
  const mod = normalizeModuleKey(moduleKey);
  const app = String(moduleAppKey || '').toLowerCase();
  if (!AUDIENCE_PRIMARY_MODULE_KEYS.has(mod)) return false;
  if (!enabledAppKeys.size) return true;
  if (app === 'platform') {
    return (
      enabledAppKeys.has('sales') ||
      enabledAppKeys.has('marketing') ||
      enabledAppKeys.has('helpdesk') ||
      enabledAppKeys.has('portal')
    );
  }
  return enabledAppKeys.has(app);
}

function pushPrimaryEntity(entities, seen, row) {
  const moduleKey = normalizeModuleKey(row.moduleKey);
  if (!AUDIENCE_PRIMARY_MODULE_KEYS.has(moduleKey) || seen.has(moduleKey)) return;
  seen.add(moduleKey);
  entities.push({
    appKey: String(row.appKey || 'sales').toLowerCase(),
    moduleKey,
    label: row.label || moduleKey,
    labelKey: row.labelKey || `modules.${moduleKey}`,
    default: row.default === true || moduleKey === 'people'
  });
}

async function listPrimaryEntities(organizationId) {
  const entities = [];
  const seen = new Set();
  const enabledAppKeys = await getOrganizationEnabledAppKeys(organizationId);
  const apps = await getEnabledAppsForTenant(organizationId);

  for (const app of apps) {
    const modules = await getEnabledModulesForApp(organizationId, app.appKey);
    for (const mod of modules) {
      pushPrimaryEntity(entities, seen, {
        appKey: app.appKey || mod.appKey,
        moduleKey: mod.moduleKey,
        label: mod.labelOverride || mod.pluralLabel || mod.moduleKey,
        labelKey: mod.labelKey || null
      });
    }
  }

  // Tenants may use Organization.enabledApps without TenantAppConfiguration rows.
  const tenantModules = await TenantModuleConfiguration.find({
    organizationId,
    enabled: true
  })
    .select('moduleKey appKey labelOverride')
    .lean()
    .catch(() => []);

  for (const mod of tenantModules) {
    pushPrimaryEntity(entities, seen, {
      appKey: mod.appKey,
      moduleKey: mod.moduleKey,
      label: mod.labelOverride || mod.moduleKey
    });
  }

  if (entities.length <= 1) {
    const platformModules = await ModuleDefinition.find({
      enabled: { $ne: false },
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    })
      .select('moduleKey appKey label pluralLabel')
      .lean()
      .catch(() => []);

    for (const mod of platformModules) {
      if (!isAudienceModuleAvailableForOrg(mod.moduleKey, mod.appKey, enabledAppKeys)) continue;
      pushPrimaryEntity(entities, seen, {
        appKey: mod.appKey,
        moduleKey: mod.moduleKey,
        label: mod.pluralLabel || mod.label || mod.moduleKey
      });
    }
  }

  if (!seen.has('people')) {
    pushPrimaryEntity(entities, seen, {
      appKey: 'sales',
      moduleKey: 'people',
      label: 'Contacts',
      labelKey: 'modules.people',
      default: true
    });
  }

  return entities.sort((a, b) => {
    if (a.default) return -1;
    if (b.default) return 1;
    return String(a.label).localeCompare(String(b.label));
  });
}

async function loadModuleFilterFields(organizationId, appKey, moduleKey) {
  const normApp = appKey || (await resolveModuleAppKey(organizationId, moduleKey));
  const normMod = normalizeModuleKey(moduleKey);
  let moduleDef = null;

  if (organizationId) {
    moduleDef = await ModuleDefinition.findOne({
      organizationId,
      moduleKey: normMod
    })
      .select('fields pipelineSettings')
      .lean();
  }

  if (!moduleDef?.fields?.length) {
    moduleDef = await ModuleDefinition.findOne({
      appKey: normApp,
      moduleKey: normMod,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }]
    })
      .select('fields pipelineSettings')
      .lean();
  }

  const fields = await loadModuleDefinitionFields(organizationId, normApp, moduleKey, {
    includeHidden: false,
    forAssignment: true
  });

  const rawFields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
  const marketingRawFields = rawFields
    .filter(isMarketingFilterableField)
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      dataType: resolveMarketingFilterType(field),
      lookupSettings: field.lookupSettings,
      options: Array.isArray(field.options) ? field.options : []
    }));

  const supplemental = [];
  if (normMod === 'people') {
    supplemental.push(
      { key: 'name', label: 'Name', dataType: 'text' },
      { key: 'email', label: 'Email', dataType: 'email' },
      { key: 'phone', label: 'Phone', dataType: 'phone' },
      { key: 'organization', label: 'Organization', dataType: 'reference' },
      { key: 'assignedTo', label: 'Assigned To', dataType: 'user' }
    );
  }

  if (normMod === 'deals') {
    supplemental.push(
      { key: 'contactId', label: 'Primary Contact', dataType: 'reference' },
      { key: 'assignedTo', label: 'Assigned To', dataType: 'user' }
    );
  }

  if (normMod === 'cases') {
    supplemental.push(
      { key: 'contactId', label: 'Contact', dataType: 'reference' },
      { key: 'assignedTo', label: 'Assigned To', dataType: 'user' }
    );
  }

  const pipelineStageNames = new Set();
  if (normMod === 'deals' && Array.isArray(moduleDef?.pipelineSettings)) {
    for (const pipeline of moduleDef.pipelineSettings) {
      for (const stage of pipeline?.stages || []) {
        const name = String(stage?.name || '').trim();
        if (name) pipelineStageNames.add(name);
      }
    }
  }

  const mergedSource = [...supplemental, ...marketingRawFields, ...fields];
  const merged = new Map();
  for (const field of mergedSource) {
    const key = String(field.key || '').trim();
    if (!key) continue;

    let options = normalizeFilterOptions(field.options);
    if (key === 'source' && !options.length) {
      options = RECORD_SOURCE_VALUES.map((value) => ({ value, label: value }));
    }
    if (key === 'stage' && pipelineStageNames.size > 0) {
      const seen = new Set(options.map((row) => row.value));
      for (const name of pipelineStageNames) {
        if (!seen.has(name)) {
          options.push({ value: name, label: name });
        }
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
    }
    if (key === 'pipeline' && Array.isArray(moduleDef?.pipelineSettings) && !options.length) {
      options = moduleDef.pipelineSettings
        .map((pipeline) => {
          const value = String(pipeline?.key || pipeline?.name || '').trim();
          if (!value) return null;
          return { value, label: String(pipeline?.name || pipeline?.key || value) };
        })
        .filter(Boolean);
    }

    merged.set(key, mapFieldToFilterConfig({ ...field, options }));
  }

  return [...merged.values()].sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

async function getModuleFieldFilterOptions(organizationId, moduleKey, fieldKey) {
  const normMod = normalizeModuleKey(moduleKey);
  const normKey = String(fieldKey || '').trim();
  if (!normMod || !normKey) return null;

  const modAppKey = await resolveModuleAppKey(organizationId, normMod);
  const fields = await loadModuleFilterFields(organizationId, modAppKey, normMod);
  return fields.find((row) => row.key === normKey) || null;
}

function buildContactResolutionMap(relationshipEdges, primaryEntities) {
  const resolution = {};
  for (const entity of primaryEntities) {
    const moduleKey = entity.moduleKey;
    if (moduleKey === 'people') continue;

    if (moduleKey === 'organizations') {
      const edge = relationshipEdges.find(
        (row) => row.fromModuleKey === 'people' && row.toModuleKey === 'organizations'
      );
      if (edge) {
        resolution[moduleKey] = {
          strategy: 'reverse_relationship',
          relationshipKey: edge.relationshipKey,
          targetModuleKey: 'people'
        };
      }
      continue;
    }

    if (moduleKey === 'deals' || moduleKey === 'cases' || moduleKey === 'quotes' || moduleKey === 'invoices' || moduleKey === 'sales_orders') {
      resolution[moduleKey] = {
        strategy: 'foreign_key_on_target',
        targetModuleKey: 'people',
        foreignKeyField: 'contactId'
      };
    }
  }
  return resolution;
}

async function getMarketingAudienceMetadata(organizationId, options = {}) {
  const primaryModuleKey = normalizeModuleKey(options.primaryModuleKey || 'people');
  const primaryEntities = await listPrimaryEntities(organizationId);
  const platformDefs = await loadPlatformRelationshipDefinitions();

  const primaryEntity =
    primaryEntities.find((row) => row.moduleKey === primaryModuleKey) ||
    primaryEntities.find((row) => row.default) ||
    primaryEntities[0];

  const { edges, graph, moduleKeys } = await buildExpandedRelationshipMetadata(
    organizationId,
    primaryModuleKey,
    platformDefs,
    MAX_RELATIONSHIP_DEPTH
  );

  const modules = {};
  for (const moduleKey of moduleKeys) {
    const modAppKey = await resolveModuleAppKey(organizationId, moduleKey);
    modules[moduleKey] = {
      appKey: modAppKey,
      fields: await loadModuleFilterFields(organizationId, modAppKey, moduleKey)
    };
  }

  const relationships = edges.map((edge) => ({
    relationshipKey: edge.relationshipKey,
    label: edge.label,
    fromModuleKey: edge.fromModuleKey,
    toModuleKey: edge.toModuleKey,
    direction: edge.direction,
    cardinality: edge.cardinality,
    linkKinds: edge.linkKinds
  }));

  return {
    primaryEntities,
    primaryEntity,
    relationships,
    relationshipGraph: graph,
    modules,
    operators: OPERATORS_BY_FILTER_TYPE,
    contactResolution: buildContactResolutionMap(edges, primaryEntities),
    limits: {
      maxRelationshipDepth: MAX_RELATIONSHIP_DEPTH,
      previewSampleMax: PREVIEW_SAMPLE_MAX,
      recipientResolveMax: RECIPIENT_RESOLVE_MAX
    }
  };
}

async function getRelationshipEdgeMetadata(organizationId, fromModuleKey, relationshipKey) {
  const normFrom = normalizeModuleKey(fromModuleKey);
  const relKey = String(relationshipKey || '').toLowerCase();
  const platformDefs = await loadPlatformRelationshipDefinitions();
  const def = platformDefs.find(
    (row) => String(row.relationshipKey || '').toLowerCase() === relKey
  );

  const appKey = await resolveModuleAppKey(organizationId, normFrom);
  const hints = await loadModuleDefinitionRelationships(organizationId, appKey, normFrom);

  if (def) {
    return buildRelationshipEdge(def, normFrom, hints);
  }

  const hint = hints.find((row) => String(row.relationshipKey || '').toLowerCase() === relKey);
  if (!hint) return null;

  const targetMod = normalizeModuleKey(hint.targetModuleKey);
  const targetAppKey = await resolveModuleAppKey(organizationId, targetMod);
  const forwardFk = hint.isLookup ? hint.localField || inferForeignKeyOnChild(normFrom, targetMod) : null;
  const reverseFk = inferForeignKeyOnChild(targetMod, normFrom);

  return {
    relationshipKey: relKey,
    label: hint.label || hint.name || targetMod,
    fromModuleKey: normFrom,
    toModuleKey: targetMod,
    direction: 'forward',
    sourceAppKey: String(appKey || '').toLowerCase(),
    targetAppKey,
    cardinality: mapHintTypeToCardinality(hint.type),
    localField: forwardFk,
    foreignField: hint.foreignField || '_id',
    isLookup: hint.isLookup === true,
    linkKinds: ['relationship_instance', ...(forwardFk || reverseFk ? ['foreign_key'] : [])]
  };
}

async function validateRelationshipPath(organizationId, primaryModuleKey, relationshipPath) {
  if (!Array.isArray(relationshipPath) || relationshipPath.length === 0) {
    return { error: 'relationshipPath must include at least one relationship key' };
  }
  if (relationshipPath.length > MAX_RELATIONSHIP_DEPTH) {
    return { error: `relationshipPath exceeds max depth of ${MAX_RELATIONSHIP_DEPTH}` };
  }

  let currentModule = normalizeModuleKey(primaryModuleKey);
  const visited = new Set();

  for (const relKey of relationshipPath) {
    const key = String(relKey || '').toLowerCase();
    if (!key) return { error: 'relationshipPath contains an empty relationship key' };
    if (visited.has(`${currentModule}:${key}`)) {
      return { error: 'relationshipPath contains a cycle' };
    }
    visited.add(`${currentModule}:${key}`);

    const edge = await getRelationshipEdgeMetadata(organizationId, currentModule, key);
    if (!edge) {
      return { error: `Unknown or unavailable relationship: ${key} from ${currentModule}` };
    }
    currentModule = edge.toModuleKey;
  }

  return { targetModuleKey: currentModule };
}

module.exports = {
  getMarketingAudienceMetadata,
  getRelationshipEdgeMetadata,
  validateRelationshipPath,
  loadModuleFilterFields,
  resolveModuleAppKey,
  listPrimaryEntities,
  getModuleFieldFilterOptions,
  normalizeMarketingFieldDataType,
  isMarketingFilterableField,
  resolveMarketingFilterType,
  buildExpandedRelationshipMetadata
};
