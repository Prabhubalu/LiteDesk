const ModuleDefinition = require('../../models/ModuleDefinition');
const RelationshipDefinition = require('../../models/RelationshipDefinition');
const { getEffectiveRelationships } = require('../../utils/tenantMetadata');
const {
  getAnalyticsModuleConfig,
  listAnalyticsModules,
} = require('./analyticsModuleRegistry');
const { getTenantAnalyticsModuleKeys, listTenantAnalyticsModules } = require('./analyticsModuleCatalogService');
const {
  getCrossModuleJoin,
  listJoinsForSource,
} = require('./analyticsRelationshipRegistry');
const { inferForeignKeyOnChild } = require('../marketing/marketingAudienceForeignKeys');

const CRM_ORG_MATCH = { isTenant: { $ne: true } };

const FALLBACK_ANALYTICS_MODULE_KEYS = new Set(
  listAnalyticsModules().map((mod) => String(mod.moduleKey || '').toLowerCase()),
);

async function getAnalyticsModuleKeySet(organizationId) {
  if (!organizationId) return FALLBACK_ANALYTICS_MODULE_KEYS;
  return getTenantAnalyticsModuleKeys(organizationId);
}

function normalizeModuleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function resolveModuleAppKey(moduleKey) {
  const cfg = getAnalyticsModuleConfig(moduleKey);
  if (cfg?.appKey) return String(cfg.appKey).toLowerCase();
  const mod = normalizeModuleKey(moduleKey);
  if (mod === 'cases') return 'helpdesk';
  if (mod === 'tasks' || mod === 'events' || mod === 'items' || mod === 'forms') return 'platform';
  return 'sales';
}

async function loadModuleDefinitionRelationships(organizationId, appKey, moduleKey) {
  const normMod = normalizeModuleKey(moduleKey);
  if (!normMod) return [];

  if (organizationId) {
    const tenantQueries = [
      { organizationId, moduleKey: normMod },
      { organizationId, key: normMod },
    ];
    for (const query of tenantQueries) {
      const tenantModuleDef = await ModuleDefinition.findOne(query).select('relationships').lean();
      if (tenantModuleDef?.relationships?.length) {
        return tenantModuleDef.relationships;
      }
    }
  }

  const appKeysToTry = new Set(
    [appKey, resolveModuleAppKey(normMod), 'platform', 'sales', 'helpdesk']
      .map((value) => String(value || '').toLowerCase())
      .filter(Boolean),
  );

  for (const normApp of appKeysToTry) {
    const moduleDef = await ModuleDefinition.findOne({
      appKey: normApp,
      moduleKey: normMod,
      $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
    })
      .select('relationships')
      .lean();
    if (moduleDef?.relationships?.length) {
      return moduleDef.relationships;
    }
  }

  return [];
}

function hintLabel(hint, fallback) {
  return String(hint?.label || hint?.name || fallback || '').trim() || fallback;
}

function mergeJoinTarget(targetMap, entry) {
  const targetModule = normalizeModuleKey(entry.targetModule);
  if (!targetModule) return;

  const existing = targetMap.get(targetModule);
  if (existing) {
    targetMap.set(targetModule, {
      ...existing,
      ...entry,
      label: entry.label || existing.label,
      joinable: existing.joinable || entry.joinable,
    });
    return;
  }

  targetMap.set(targetModule, entry);
}

function registryTargetToJoinTarget(rel) {
  return {
    relationshipKey: rel.relationshipKey,
    targetModule: rel.targetModule,
    joinType: rel.joinType || 'left',
    requiresJoin: rel.requiresJoin || null,
    label: rel.targetModule,
    joinable: true,
  };
}

async function listJoinTargetsForModule(organizationId, primaryModuleKey) {
  const primary = normalizeModuleKey(primaryModuleKey);
  if (!primary) return [];

  const analyticsModuleKeys = await getAnalyticsModuleKeySet(organizationId);
  const appKey = resolveModuleAppKey(primary);
  const targetMap = new Map();

  for (const rel of listJoinsForSource(primary)) {
    mergeJoinTarget(targetMap, registryTargetToJoinTarget(rel));
  }

  const hints = await loadModuleDefinitionRelationships(organizationId, appKey, primary);
  const effective = organizationId
    ? await getEffectiveRelationships(organizationId, appKey.toUpperCase(), primary)
    : [];

  for (const rel of effective) {
    const sourceMod = normalizeModuleKey(rel.source?.moduleKey);
    const targetMod = normalizeModuleKey(rel.target?.moduleKey);
    if (sourceMod !== primary || !analyticsModuleKeys.has(targetMod)) continue;

    const hint = hints.find(
      (row) => String(row.relationshipKey || '').toLowerCase() === String(rel.relationshipKey || '').toLowerCase(),
    );
    const localField =
      rel.localField ||
      (hint?.isLookup ? hint.localField : null) ||
      inferForeignKeyOnChild(primary, targetMod);
    const reverseField = inferForeignKeyOnChild(targetMod, primary);

    mergeJoinTarget(targetMap, {
      relationshipKey: rel.relationshipKey,
      targetModule: targetMod,
      joinType: 'left',
      requiresJoin: null,
      label: hintLabel(hint, rel.ui?.target?.label || targetMod),
      joinable: Boolean(localField || reverseField || getCrossModuleJoin(primary, targetMod)),
    });
  }

  for (const hint of hints) {
    const targetMod = normalizeModuleKey(hint.targetModuleKey);
    if (!targetMod || !analyticsModuleKeys.has(targetMod)) continue;

    const relKey = String(hint.relationshipKey || `${primary}_${targetMod}`).toLowerCase();
    const localField =
      (hint.isLookup ? hint.localField : null) || inferForeignKeyOnChild(primary, targetMod);
    const reverseField = inferForeignKeyOnChild(targetMod, primary);

    mergeJoinTarget(targetMap, {
      relationshipKey: relKey,
      targetModule: targetMod,
      joinType: 'left',
      requiresJoin: null,
      label: hintLabel(hint, targetMod),
      joinable: Boolean(localField || reverseField || getCrossModuleJoin(primary, targetMod)),
    });
  }

  return [...targetMap.values()]
    .map((target) => {
      const registryJoin = getCrossModuleJoin(primary, target.targetModule);
      if (registryJoin?.requiresJoin) {
        return { ...target, requiresJoin: registryJoin.requiresJoin };
      }
      return target;
    })
    .sort((a, b) =>
      String(a.label || a.targetModule).localeCompare(String(b.label || b.targetModule)),
    );
}

async function listConfiguredRelationships(organizationId) {
  const modules = await listTenantAnalyticsModules(organizationId);
  const relationships = [];

  for (const mod of modules) {
    const joinTargets = await listJoinTargetsForModule(organizationId, mod.moduleKey);
    for (const target of joinTargets) {
      relationships.push({
        relationshipKey: target.relationshipKey,
        sourceModule: mod.moduleKey,
        targetModule: target.targetModule,
        joinType: target.joinType || 'left',
        requiresJoin: target.requiresJoin || null,
        joinable: target.joinable !== false,
        label: target.label || target.targetModule,
      });
    }
  }

  return relationships;
}

function buildForwardJoinConfig(primary, target, targetConfig, localField, relationshipKey) {
  return {
    relationshipKey,
    sourceModule: primary,
    targetModule: target,
    localField,
    targetCollection: targetConfig.collection,
    targetModel: targetConfig.model,
    joinAs: `_analytics_join_${target}`,
    targetMatch: target === 'organizations' ? CRM_ORG_MATCH : undefined,
  };
}

function buildReverseJoinConfig(primary, target, targetConfig, reverseLocalField, relationshipKey) {
  if (!reverseLocalField || reverseLocalField.includes('.')) {
    return null;
  }

  return {
    relationshipKey,
    sourceModule: primary,
    targetModule: target,
    reverseJoin: true,
    reverseLocalField,
    targetCollection: targetConfig.collection,
    targetModel: targetConfig.model,
    joinAs: `_analytics_join_${target}`,
    targetMatch: target === 'organizations' ? CRM_ORG_MATCH : undefined,
  };
}

async function resolveAnalyticsJoin(primaryModule, targetModule, organizationId) {
  const primary = normalizeModuleKey(primaryModule);
  const target = normalizeModuleKey(targetModule);
  if (!primary || !target || primary === target) return null;

  const hardcoded = getCrossModuleJoin(primary, target);
  if (hardcoded) return hardcoded;

  const targetConfig = getAnalyticsModuleConfig(target);
  if (!targetConfig?.model) return null;

  const appKey = resolveModuleAppKey(primary);
  const hints = await loadModuleDefinitionRelationships(organizationId, appKey, primary);
  const effective = organizationId
    ? await getEffectiveRelationships(organizationId, appKey.toUpperCase(), primary)
    : [];

  const hint = hints.find((row) => normalizeModuleKey(row.targetModuleKey) === target);
  const effectiveRel = effective.find(
    (row) =>
      normalizeModuleKey(row.source?.moduleKey) === primary &&
      normalizeModuleKey(row.target?.moduleKey) === target,
  );

  const relationshipKey =
    effectiveRel?.relationshipKey ||
    hint?.relationshipKey ||
    `${primary}_${target}`;

  const localField =
    effectiveRel?.localField ||
    (hint?.isLookup ? hint.localField : null) ||
    inferForeignKeyOnChild(primary, target);

  if (localField) {
    return buildForwardJoinConfig(primary, target, targetConfig, localField, relationshipKey);
  }

  const reverseField = inferForeignKeyOnChild(target, primary);
  return buildReverseJoinConfig(primary, target, targetConfig, reverseField, relationshipKey);
}

async function sortJoinModulesWithRelationships(primaryModule, joinModules, organizationId) {
  const primary = normalizeModuleKey(primaryModule);
  const ordered = [];
  const seen = new Set();

  async function visit(targetModule) {
    const mod = normalizeModuleKey(targetModule);
    if (!mod || seen.has(mod)) return;

    const join = (await resolveAnalyticsJoin(primary, mod, organizationId)) || getCrossModuleJoin(primary, mod);
    if (!join) return;

    if (join.requiresJoin && !seen.has(join.requiresJoin)) {
      await visit(join.requiresJoin);
    }

    seen.add(mod);
    ordered.push(mod);
  }

  for (const mod of joinModules) {
    await visit(mod);
  }

  return ordered;
}

module.exports = {
  listJoinTargetsForModule,
  listConfiguredRelationships,
  resolveAnalyticsJoin,
  sortJoinModulesWithRelationships,
  loadModuleDefinitionRelationships,
};
