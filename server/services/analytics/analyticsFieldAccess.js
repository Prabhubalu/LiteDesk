const ModuleDefinition = require('../../models/ModuleDefinition');
const { canReadField } = require('../../utils/fieldAccessControl');
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');
const { getBaseFieldsForKey } = require('../../controllers/moduleController');

const fieldCache = new Map();

function cacheKey(organizationId, moduleKey) {
  return `${organizationId}:${moduleKey}`;
}

function resolvePlatformAppKey(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  const config = getAnalyticsModuleConfig(key);
  if (config?.appKey) {
    return String(config.appKey).toLowerCase();
  }
  if (key === 'deals') return 'sales';
  return 'platform';
}

function mergeSavedFieldsWithBase(baseFields, savedFields) {
  if (!Array.isArray(savedFields) || savedFields.length === 0) {
    return Array.isArray(baseFields) ? [...baseFields] : [];
  }
  const seen = new Set(
    savedFields.map((field) => String(field?.key || '').trim().toLowerCase()).filter(Boolean),
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

async function findModuleDefinition(organizationId, moduleKey) {
  const normalized = String(moduleKey || '').trim().toLowerCase();
  if (!normalized) return null;

  const orgId = organizationId || null;
  const orgQuery = {
    organizationId: orgId,
    status: { $ne: 'archived' },
    $or: [{ moduleKey: normalized }, { key: normalized }],
  };

  let moduleDef = await ModuleDefinition.findOne(orgQuery)
    .select('fields moduleKey appKey key')
    .lean();

  if (moduleDef?.fields?.length) {
    return moduleDef;
  }

  const platformAppKey = resolvePlatformAppKey(normalized);
  const platformQueries = [
    {
      organizationId: null,
      moduleKey: normalized,
      appKey: platformAppKey,
    },
    {
      organizationId: null,
      moduleKey: normalized,
      isPlatform: true,
    },
    {
      organizationId: { $exists: false },
      moduleKey: normalized,
      appKey: platformAppKey,
    },
  ];

  if (platformAppKey !== 'platform') {
    platformQueries.push({
      organizationId: null,
      moduleKey: normalized,
      appKey: 'platform',
    });
  }

  for (const query of platformQueries) {
    moduleDef = await ModuleDefinition.findOne(query)
      .select('fields moduleKey appKey key')
      .lean();
    if (moduleDef?.fields?.length) {
      return moduleDef;
    }
  }

  return moduleDef;
}

async function loadModuleFields(organizationId, moduleKey) {
  const key = cacheKey(organizationId, moduleKey);
  if (fieldCache.has(key)) return fieldCache.get(key);

  const normalized = String(moduleKey || '').trim().toLowerCase();
  const moduleDef = await findModuleDefinition(organizationId, normalized);
  const savedFields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
  const baseFields = getBaseFieldsForKey(normalized) || [];
  const registryDefaults = getAnalyticsModuleConfig(normalized)?.defaultFields || [];

  let fields = mergeSavedFieldsWithBase(baseFields, savedFields);
  if (!fields.length && registryDefaults.length) {
    fields = registryDefaults.map((fieldKey) => ({
      key: fieldKey,
      label: fieldKey,
      type: 'string',
    }));
  }

  const payload = {
    fields,
    appKey: moduleDef?.appKey || getAnalyticsModuleConfig(normalized)?.appKey,
  };
  fieldCache.set(key, payload);
  return payload;
}

function parseColumnModuleField(columnKey) {
  const raw = String(columnKey || '').trim();
  if (!raw.includes('.')) return { moduleKey: null, fieldKey: raw };
  const dot = raw.indexOf('.');
  return {
    moduleKey: raw.slice(0, dot).toLowerCase(),
    fieldKey: raw.slice(dot + 1),
  };
}

function findFieldDef(fields, fieldKey) {
  if (!fieldKey) return null;
  const direct = fields.find((f) => f.key === fieldKey);
  if (direct) return direct;
  const tail = fieldKey.includes('.') ? fieldKey.split('.').pop() : fieldKey;
  return fields.find((f) => f.key === tail) || { key: tail, label: tail };
}

async function isColumnReadable(user, organizationId, primaryModule, columnKey, relatedModules = []) {
  if (!user) return true;
  if (user.isOwner) return true;

  const parsed = parseColumnModuleField(columnKey);
  const moduleKey = parsed.moduleKey || primaryModule;
  const allowedModules = new Set([
    String(primaryModule || '').toLowerCase(),
    ...(relatedModules || []).map((m) => String(m).toLowerCase()),
  ]);

  if (!allowedModules.has(String(moduleKey).toLowerCase())) {
    return false;
  }

  const { fields, appKey } = await loadModuleFields(organizationId, moduleKey);
  if (!fields.length) return true;

  const fieldDef = findFieldDef(fields, parsed.fieldKey);
  if (!fieldDef) return true;

  return canReadField(fieldDef, user, moduleKey, appKey);
}

async function applyFieldLevelSecurityToResult(result, user, primaryModule, relatedModules = [], organizationId) {
  if (!user || !result?.columns?.length) return result;

  const readableKeys = [];
  for (const col of result.columns) {
    const ok = await isColumnReadable(user, organizationId, primaryModule, col.key, relatedModules);
    if (ok) readableKeys.push(col.key);
  }

  if (readableKeys.length === result.columns.length) return result;

  const keySet = new Set(readableKeys);
  return {
    ...result,
    columns: result.columns.filter((col) => keySet.has(col.key)),
    rows: (result.rows || []).map((row) => {
      const next = {};
      for (const key of readableKeys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          next[key] = row[key];
        }
      }
      return next;
    }),
    meta: {
      ...result.meta,
      fieldLevelSecurityApplied: true,
      strippedColumnCount: result.columns.length - readableKeys.length,
    },
  };
}

function clearFieldAccessCache() {
  fieldCache.clear();
}

module.exports = {
  loadModuleFields,
  applyFieldLevelSecurityToResult,
  clearFieldAccessCache,
};
