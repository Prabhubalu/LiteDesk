const { applyFilterQueryToMongoQuery } = require('./filterQueryCompiler');
const { buildDateFieldQuery } = require('./listQueryBuilders/tasksListQuery');

const DATE_PARAM_SUFFIXES = ['Preset', 'Op', 'From', 'To', 'Days'];

/** Modules whose list APIs accept flat assignedTo (incl. me / unassigned). */
const ASSIGNED_TO_LIST_MODULES = new Set([
  'people',
  'tasks',
  'deals',
  'organizations',
  'events',
  'forms',
  'quotes',
  'sales_orders',
  'invoices',
  'cases',
  'documents',
]);

/**
 * Audit user fields accepted as flat list params (me / unassigned / userId).
 * Prefer filterQuery AST from the client; flat support covers saved views / legacy payloads.
 */
const FLAT_USER_IDENTITY_FIELDS = ['createdBy', 'modifiedBy'];

/**
 * Collect field prefixes that have date filter query params ({field}Preset / {field}Op / …).
 * @param {Record<string, unknown>} params
 * @returns {Set<string>}
 */
function collectDateFilterPrefixes(params) {
  const prefixes = new Set();
  if (!params || typeof params !== 'object') return prefixes;
  for (const key of Object.keys(params)) {
    for (const suffix of DATE_PARAM_SUFFIXES) {
      if (key.endsWith(suffix) && key.length > suffix.length) {
        prefixes.add(key.slice(0, -suffix.length));
        break;
      }
    }
  }
  return prefixes;
}

/**
 * Apply flat date Quick Filter / Specific Date params onto a Mongo list query.
 * Product-wide so every module list understands {field}Preset=fromNow|beforeNow|today|…
 * @param {object} query
 * @param {Record<string, unknown>} params
 */
function applyDateFilterQueryParams(query, params) {
  const prefixes = collectDateFilterPrefixes(params);
  if (prefixes.size === 0) return query;

  let next = { ...query };
  for (const prefix of prefixes) {
    const condition = buildDateFieldQuery(prefix, params);
    if (condition === 'EMPTY') {
      next.$and = [
        ...(next.$and || []),
        { $or: [{ [prefix]: null }, { [prefix]: { $exists: false } }] },
      ];
    } else if (condition) {
      next[prefix] = condition;
    }
  }
  return next;
}

/**
 * Resolve a single flat user-identity param (userId | "me" | "unassigned" | "null").
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {string} fieldKey
 * @param {{ userId?: unknown }} [context]
 */
function applyFlatUserIdentityField(query, params, fieldKey, context = {}) {
  const next = { ...(query || {}) };
  const raw = params?.[fieldKey];
  if (raw === undefined || raw === '') {
    return next;
  }

  if (raw === 'unassigned' || raw === 'null') {
    delete next[fieldKey];
    next.$and = [
      ...(next.$and || []),
      { $or: [{ [fieldKey]: null }, { [fieldKey]: { $exists: false } }] },
    ];
    return next;
  }

  if (raw === 'assigned') {
    delete next[fieldKey];
    next.$and = [
      ...(next.$and || []),
      { [fieldKey]: { $ne: null, $exists: true } },
    ];
    return next;
  }

  const resolved = raw === 'me' ? context.userId : raw;
  if (!resolved) return next;
  next[fieldKey] = resolved;
  return next;
}

/**
 * Resolve flat assignedTo list params (userId | "me" | "unassigned" | "null").
 * Also rewrites query.assignedTo === "me" left by module-specific builders.
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {string} moduleKey
 * @param {{ userId?: unknown }} [context]
 */
function applyFlatAssignedToQueryParam(query, params, moduleKey, context = {}) {
  const module = String(moduleKey || '').toLowerCase();
  const next = { ...(query || {}) };

  if (next.assignedTo === 'me') {
    if (context.userId) next.assignedTo = context.userId;
    else delete next.assignedTo;
  }

  if (module && !ASSIGNED_TO_LIST_MODULES.has(module)) {
    return next;
  }

  return applyFlatUserIdentityField(next, params, 'assignedTo', context);
}

/**
 * Apply flat createdBy / modifiedBy list params across modules.
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {{ userId?: unknown }} [context]
 */
function applyFlatAuditUserQueryParams(query, params, context = {}) {
  let next = { ...(query || {}) };
  for (const fieldKey of FLAT_USER_IDENTITY_FIELDS) {
    next = applyFlatUserIdentityField(next, params, fieldKey, context);
  }
  return next;
}

/**
 * Applies client date-filter params + flat assignedTo/createdBy + optional filterQuery AST to a Mongo list query.
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {string} moduleKey
 * @param {{ userId?: unknown }} [context]
 */
function applyListFilterQueryParam(query, params, moduleKey, context = {}) {
  let next = applyDateFilterQueryParams(query, params);
  next = applyFlatAssignedToQueryParam(next, params, moduleKey, context);
  next = applyFlatAuditUserQueryParams(next, params, context);
  if (!params?.filterQuery) return next;
  return applyFilterQueryToMongoQuery(next, params.filterQuery, moduleKey, context);
}

module.exports = {
  applyListFilterQueryParam,
  applyDateFilterQueryParams,
  applyFlatAssignedToQueryParam,
  applyFlatAuditUserQueryParams,
  collectDateFilterPrefixes,
  ASSIGNED_TO_LIST_MODULES,
  FLAT_USER_IDENTITY_FIELDS,
};
