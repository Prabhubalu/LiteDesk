const ModuleDefinition = require('../../models/ModuleDefinition');
const { canReadField } = require('../../utils/fieldAccessControl');
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');

const fieldCache = new Map();

function cacheKey(organizationId, moduleKey) {
  return `${organizationId}:${moduleKey}`;
}

async function loadModuleFields(organizationId, moduleKey) {
  const key = cacheKey(organizationId, moduleKey);
  if (fieldCache.has(key)) return fieldCache.get(key);

  const orgId = organizationId || null;
  let moduleDef = await ModuleDefinition.findOne({
    organizationId: orgId,
    moduleKey,
    status: { $ne: 'archived' },
  })
    .select('fields moduleKey appKey')
    .lean();

  if (!moduleDef) {
    moduleDef = await ModuleDefinition.findOne({
      organizationId: null,
      moduleKey,
      isPlatform: true,
    })
      .select('fields moduleKey appKey')
      .lean();
  }

  const fields = Array.isArray(moduleDef?.fields) ? moduleDef.fields : [];
  fieldCache.set(key, { fields, appKey: moduleDef?.appKey || getAnalyticsModuleConfig(moduleKey)?.appKey });
  return fieldCache.get(key);
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
