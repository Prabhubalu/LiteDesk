'use strict';

function getValueByPath(source, path) {
  if (!path) return undefined;
  const parts = String(path).split('.');
  let current = source;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function toComparableDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function evaluateClause(clause, data) {
  const left = getValueByPath(data, clause.field);
  const right = clause.value;
  const operator = String(clause.operator || 'equals').toLowerCase();

  switch (operator) {
    case 'equals':
    case '==':
    case '===':
      if (left === right) return true;
      if (typeof left === 'string' && typeof right === 'string') {
        return left.trim().toLowerCase() === right.trim().toLowerCase();
      }
      return false;
    case 'not_equals':
    case '!=':
    case '!==':
      if (left === right) return false;
      if (typeof left === 'string' && typeof right === 'string') {
        return left.trim().toLowerCase() !== right.trim().toLowerCase();
      }
      return left !== right;
    case 'contains':
      return String(left || '').toLowerCase().includes(String(right || '').toLowerCase());
    case 'in':
      return Array.isArray(right) && right.some((v) => v === left
        || (typeof v === 'string' && typeof left === 'string' && v.toLowerCase() === left.toLowerCase()));
    case 'not_in':
      return Array.isArray(right) && !right.some((v) => v === left
        || (typeof v === 'string' && typeof left === 'string' && v.toLowerCase() === left.toLowerCase()));
    case 'exists':
      return left !== undefined && left !== null && left !== '';
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'before': {
      const leftDate = toComparableDate(left);
      const rightDate = toComparableDate(right);
      return leftDate && rightDate ? leftDate < rightDate : false;
    }
    case 'after': {
      const leftDate = toComparableDate(left);
      const rightDate = toComparableDate(right);
      return leftDate && rightDate ? leftDate > rightDate : false;
    }
    case 'is_true':
      return left === true || left === 'true' || left === 1 || left === '1';
    case 'is_false':
      return left === false || left === 'false' || left === 0 || left === '0';
    default:
      return false;
  }
}

function evaluateConditionGroup(group, data) {
  if (!group || typeof group !== 'object') return true;

  const combinator = String(group.combinator || 'all').toLowerCase();
  const clauseResults = Array.isArray(group.clauses)
    ? group.clauses.map((clause) => evaluateClause(clause, data))
    : [];
  const groupResults = Array.isArray(group.groups)
    ? group.groups.map((child) => evaluateConditionGroup(child, data))
    : [];
  const results = [...clauseResults, ...groupResults];

  if (results.length === 0) return true;
  return combinator === 'any' ? results.some(Boolean) : results.every(Boolean);
}

module.exports = {
  getValueByPath,
  evaluateClause,
  evaluateConditionGroup
};
