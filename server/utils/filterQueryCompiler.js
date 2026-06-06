/**
 * Compiles client filterQuery AST into MongoDB boolean clauses.
 */

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveFieldKey(fieldKey, moduleKey) {
  const key = String(fieldKey || '').trim();
  if (!key) return key;

  if (moduleKey === 'people' && (key === 'sales_type' || key === 'helpdesk_role')) {
    try {
      const { getPeopleFieldQueryPath } = require('./peopleFieldRegistry');
      return getPeopleFieldQueryPath(key);
    } catch {
      return key;
    }
  }

  return key;
}

function compileIsEmptyClause(fieldKey, value) {
  if (value === 'unassigned') {
    return {
      $or: [{ [fieldKey]: null }, { [fieldKey]: { $exists: false } }],
    };
  }
  if (value === '' && fieldKey === 'organization') {
    return {
      $or: [{ [fieldKey]: null }, { [fieldKey]: { $exists: false } }],
    };
  }
  return { [fieldKey]: null };
}

function compileIsNotEmptyClause(fieldKey, value) {
  if (value === 'assigned' || value === 'has') {
    return { [fieldKey]: { $ne: null, $exists: true } };
  }
  return {
    [fieldKey]: { $nin: [null, ''], $exists: true },
  };
}

function compileUserFilterClause(fieldKey, value, operator, context = {}) {
  if (value === 'unassigned') {
    return operator === 'is_not'
      ? compileIsNotEmptyClause(fieldKey, 'assigned')
      : compileIsEmptyClause(fieldKey, 'unassigned');
  }

  if (value === 'assigned') {
    return operator === 'is_not'
      ? compileIsEmptyClause(fieldKey, 'unassigned')
      : compileIsNotEmptyClause(fieldKey, 'assigned');
  }

  if (value === 'me') {
    const userId = context.userId;
    if (!userId) return null;
    return operator === 'is_not'
      ? { [fieldKey]: { $ne: userId } }
      : { [fieldKey]: userId };
  }

  return null;
}

function compileRuleToMongo(rule, moduleKey, context = {}) {
  const fieldKey = resolveFieldKey(rule.fieldKey, moduleKey);
  const operator = String(rule.operator || 'is');
  const value = rule.value;

  if (!fieldKey) return null;

  if (operator === 'is_empty') {
    return compileIsEmptyClause(fieldKey, value);
  }

  if (operator === 'is_not_empty') {
    return compileIsNotEmptyClause(fieldKey, value);
  }

  if (operator === 'is' || operator === 'is_not') {
    const userClause = compileUserFilterClause(fieldKey, value, operator, context);
    if (userClause) return userClause;
  }

  if (operator === 'contains' && typeof value === 'string') {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { [fieldKey]: new RegExp(escaped, 'i') };
  }

  if (operator === 'not_contains' && typeof value === 'string') {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { [fieldKey]: { $not: new RegExp(escaped, 'i') } };
  }

  if (operator === 'is_any_of' && Array.isArray(value)) {
    return { [fieldKey]: { $in: value } };
  }

  if (operator === 'is_not') {
    if (value === null || value === 'null') {
      return { [fieldKey]: { $ne: null, $exists: true } };
    }
    return { [fieldKey]: { $ne: value } };
  }

  if (value === null) {
    return { [fieldKey]: null };
  }

  return { [fieldKey]: value };
}

function compileNode(node, moduleKey, context = {}) {
  if (!node) return null;

  if (node.fieldKey) {
    return compileRuleToMongo(node, moduleKey, context);
  }

  const logic = String(node.logic || 'AND').toUpperCase() === 'OR' ? '$or' : '$and';
  const children = Array.isArray(node.children) ? node.children : [];
  const clauses = children
    .map((child) => compileNode(child, moduleKey, context))
    .filter(Boolean);

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return { [logic]: clauses };
}

function parseFilterQueryParam(raw) {
  if (!raw) return null;
  if (isPlainObject(raw)) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} baseQuery
 * @param {string|object|null} filterQueryParam
 * @param {string} moduleKey
 * @param {{ userId?: string|import('mongoose').Types.ObjectId }} [context]
 */
function applyFilterQueryToMongoQuery(baseQuery, filterQueryParam, moduleKey, context = {}) {
  const ast = parseFilterQueryParam(filterQueryParam);
  if (!ast) return baseQuery;

  const compiled = compileNode(ast, moduleKey, context);
  if (!compiled) return baseQuery;

  const next = { ...baseQuery };
  if (next.$and) {
    next.$and = [...next.$and, compiled];
  } else {
    next.$and = [compiled];
  }
  return next;
}

module.exports = {
  parseFilterQueryParam,
  compileNode,
  applyFilterQueryToMongoQuery,
};
