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

  const raw = params?.assignedTo;
  if (raw === undefined || raw === '') {
    return next;
  }

  if (raw === 'unassigned' || raw === 'null') {
    delete next.assignedTo;
    next.$and = [
      ...(next.$and || []),
      { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
    ];
    return next;
  }

  const resolved = raw === 'me' ? context.userId : raw;
  if (!resolved) return next;
  next.assignedTo = resolved;
  return next;
}

/**
 * Applies client date-filter params + flat assignedTo + optional filterQuery AST to a Mongo list query.
 * @param {object} query
 * @param {Record<string, unknown>} params
 * @param {string} moduleKey
 * @param {{ userId?: unknown }} [context]
 */
function applyListFilterQueryParam(query, params, moduleKey, context = {}) {
  let next = applyDateFilterQueryParams(query, params);
  next = applyFlatAssignedToQueryParam(next, params, moduleKey, context);
  if (!params?.filterQuery) return next;
  return applyFilterQueryToMongoQuery(next, params.filterQuery, moduleKey, context);
}

module.exports = {
  applyListFilterQueryParam,
  applyDateFilterQueryParams,
  applyFlatAssignedToQueryParam,
  collectDateFilterPrefixes,
  ASSIGNED_TO_LIST_MODULES,
};
