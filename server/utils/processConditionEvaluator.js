'use strict';

/**
 * Process IF-node condition evaluation.
 *
 * Shape:
 * {
 *   conditionGroup: {
 *     blockCombinator: 'AND' | 'OR',  // between Block 1 and Block 2
 *     andBlock: { conditions: Leaf[] }, // Block 1 — all must match
 *     orBlock:  { conditions: Leaf[] }  // Block 2 — any may match
 *   }
 * }
 *
 * Leaf: { field, operator, value }
 * Legacy single `{ condition: Leaf }` still supported.
 */

function resolveFieldValue(field, event, dataBag) {
  if (!field) return null;
  const f = String(field);
  if (f.startsWith('event.currentState.')) {
    const path = f.replace('event.currentState.', '');
    return path.split('.').reduce((obj, key) => obj?.[key], event?.currentState);
  }
  if (f.startsWith('event.')) {
    const path = f.replace('event.', '');
    return path.split('.').reduce((obj, key) => obj?.[key], event);
  }
  if (f.startsWith('dataBag.')) {
    return dataBag?.[f.replace('dataBag.', '')];
  }
  return dataBag?.[f] ?? event?.[f] ?? null;
}

function normalizeValueList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v !== '');
  if (value == null || value === '') return [];
  return [String(value)];
}

function participationAppKeys(fieldValue) {
  if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) return [];
  return Object.keys(fieldValue)
    .filter((k) => fieldValue[k] != null)
    .map((k) => String(k).toUpperCase());
}

function isParticipationsField(field) {
  const f = String(field || '').toLowerCase();
  return f === 'participations' || f.endsWith('.participations') || f.endsWith('currentstate.participations');
}

function resolveLeafCompareValue(leaf, event, dataBag) {
  const mode = String(leaf?.valueMode || 'raw').toLowerCase();
  if (mode === 'expression') {
    const { resolveExpression, buildScope } = require('./processFieldValueResolver');
    const expr = leaf.expression ?? leaf.value ?? '';
    try {
      return resolveExpression(String(expr || ''), buildScope({ event, dataBag }));
    } catch {
      return null;
    }
  }
  return leaf?.value;
}

function evaluateLeaf(leaf, event, dataBag) {
  if (!leaf?.field || !leaf?.operator) return false;
  const fieldValue = resolveFieldValue(leaf.field, event, dataBag);
  const value = resolveLeafCompareValue(leaf, event, dataBag);
  const operator = String(leaf.operator);

  const { evaluateDateFilterAwareCompare } = require('./dateFilterValueResolve');
  const dateAware = evaluateDateFilterAwareCompare(fieldValue, operator, value);
  if (dateAware !== null) return dateAware;

  // People.participations is an object keyed by app (SALES, HELPDESK, …)
  if (isParticipationsField(leaf.field)) {
    const apps = participationAppKeys(fieldValue);
    const wanted = normalizeValueList(value).map((v) => v.toUpperCase());
    switch (operator) {
      case 'equals':
      case '===':
        return wanted.length > 0 && wanted.every((a) => apps.includes(a));
      case 'not_equals':
      case '!==':
        return wanted.length === 0 || !wanted.some((a) => apps.includes(a));
      case 'contains':
        return wanted.some((a) => apps.includes(a));
      case 'exists':
        return apps.length > 0;
      default:
        return false;
    }
  }

  // Generic multi-select value (array)
  if (Array.isArray(value)) {
    const wanted = normalizeValueList(value);
    const present = Array.isArray(fieldValue)
      ? fieldValue.map(String)
      : fieldValue == null || fieldValue === ''
        ? []
        : [String(fieldValue)];
    switch (operator) {
      case 'equals':
      case '===':
        return wanted.length > 0 && wanted.every((v) => present.includes(v));
      case 'not_equals':
      case '!==':
        return wanted.length === 0 || !wanted.some((v) => present.includes(v));
      case 'contains':
        return wanted.some((v) => present.includes(v));
      case 'exists':
        return present.length > 0;
      default:
        return false;
    }
  }

  switch (operator) {
    case 'equals':
    case '===':
      return fieldValue === value || String(fieldValue ?? '') === String(value ?? '');
    case 'not_equals':
    case '!==':
      return fieldValue !== value && String(fieldValue ?? '') !== String(value ?? '');
    case 'contains':
      return String(fieldValue || '').includes(String(value || ''));
    case 'exists':
      return fieldValue != null && fieldValue !== '';
    case 'greater_than':
      return Number(fieldValue) > Number(value);
    case 'less_than':
      return Number(fieldValue) < Number(value);
    default:
      return false;
  }
}

function normalizeCombinator(raw) {
  const c = String(raw || 'AND').toUpperCase();
  if (c === 'ANY' || c === 'OR') return 'OR';
  return 'AND';
}

function isLeaf(item) {
  return item && typeof item === 'object' && !Array.isArray(item.conditions) && item.field != null;
}

function normalizeLeaf(item) {
  const mode = String(item?.valueMode || 'raw').toLowerCase();
  return {
    field: item?.field || '',
    operator: item?.operator || 'equals',
    valueMode: mode === 'expression' ? 'expression' : 'raw',
    value: item?.value ?? '',
    expression: item?.expression != null ? String(item.expression) : ''
  };
}

/**
 * Field key for Mongo queries (strip event.currentState. / event. prefixes).
 */
function mongoFieldKey(field) {
  return String(field || '')
    .replace(/^event\.currentState\./, '')
    .replace(/^event\./, '')
    .replace(/^trigger\./, '')
    .trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert one condition leaf into a Mongo filter clause.
 * @param {object} leaf
 * @param {object} context - { event, dataBag } for expression resolution
 */
function leafToMongoClause(leaf, context = {}) {
  const key = mongoFieldKey(leaf?.field);
  if (!key || !leaf?.operator) return null;
  const operator = String(leaf.operator);
  const value = resolveLeafCompareValue(leaf, context.event || {}, context.dataBag || {});

  const { isDateFilterValue, dateFilterValueToMongoCondition } = require('./dateFilterValueResolve');
  if (isDateFilterValue(value)) {
    const cond = dateFilterValueToMongoCondition(value);
    if (cond === 'EMPTY') {
      return {
        $and: [
          { $or: [{ [key]: null }, { [key]: { $exists: false } }, { [key]: '' }] },
        ],
      };
    }
    if (!cond) return null;
    if (operator === 'not_equals' || operator === '!==') {
      return { $nor: [{ [key]: cond }] };
    }
    if (
      operator === 'equals' ||
      operator === '===' ||
      operator === 'greater_than' ||
      operator === 'less_than'
    ) {
      // Range / open-ended presets already encode the comparison
      return { [key]: cond };
    }
  }

  switch (operator) {
    case 'equals':
    case '===':
      return { [key]: value };
    case 'not_equals':
    case '!==':
      return { [key]: { $ne: value } };
    case 'contains':
      return { [key]: { $regex: escapeRegex(value == null ? '' : String(value)), $options: 'i' } };
    case 'exists':
      return {
        $and: [
          { [key]: { $exists: true } },
          { [key]: { $nin: [null, ''] } }
        ]
      };
    case 'greater_than':
      return { [key]: { $gt: Number(value) } };
    case 'less_than':
      return { [key]: { $lt: Number(value) } };
    default:
      return null;
  }
}

function blockToMongoFilter(conditions, mode, context) {
  const leaves = Array.isArray(conditions) ? conditions.filter((c) => c?.field && c?.operator) : [];
  const clauses = leaves.map((leaf) => leafToMongoClause(leaf, context)).filter(Boolean);
  if (!clauses.length) return null;
  if (clauses.length === 1) return clauses[0];
  return mode === 'OR' ? { $or: clauses } : { $and: clauses };
}

/**
 * Build Mongo filter from process condition group (AND block + OR block).
 * Empty group → {}.
 */
function conditionGroupToMongoFilter(groupOrConfig, context = {}) {
  const group = normalizeConditionGroup(
    groupOrConfig?.andBlock || groupOrConfig?.orBlock
      ? groupOrConfig
      : { conditionGroup: groupOrConfig }
  );
  const andFilter = blockToMongoFilter(group.andBlock?.conditions, 'AND', context);
  const orFilter = blockToMongoFilter(group.orBlock?.conditions, 'OR', context);
  const parts = [andFilter, orFilter].filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  const between = normalizeCombinator(group.blockCombinator);
  return between === 'OR' ? { $or: parts } : { $and: parts };
}

function collectLeaves(items, out = []) {
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    if (isLeaf(item)) out.push(normalizeLeaf(item));
    else if (item && Array.isArray(item.conditions)) collectLeaves(item.conditions, out);
  }
  return out;
}

function emptyLeaf() {
  return { field: '', operator: 'equals', valueMode: 'raw', value: '', expression: '' };
}

/**
 * Normalize process node config into two-block shape.
 */
function normalizeConditionGroup(config) {
  if (!config || typeof config !== 'object') {
    return {
      blockCombinator: 'AND',
      andBlock: { conditions: [] },
      orBlock: { conditions: [] }
    };
  }

  const cg = config.conditionGroup && typeof config.conditionGroup === 'object'
    ? config.conditionGroup
    : config;

  // Already two-block shape
  if (cg.andBlock || cg.orBlock) {
    return {
      blockCombinator: normalizeCombinator(cg.blockCombinator),
      andBlock: {
        conditions: Array.isArray(cg.andBlock?.conditions) ? cg.andBlock.conditions : []
      },
      orBlock: {
        conditions: Array.isArray(cg.orBlock?.conditions) ? cg.orBlock.conditions : []
      }
    };
  }

  // Previous nested-group shape → put leaves into AND block
  if (Array.isArray(cg.conditions)) {
    const leaves = collectLeaves(cg.conditions);
    const combinator = normalizeCombinator(cg.combinator || cg.logic);
    if (combinator === 'OR') {
      return {
        blockCombinator: 'AND',
        andBlock: { conditions: [] },
        orBlock: { conditions: leaves }
      };
    }
    return {
      blockCombinator: 'AND',
      andBlock: { conditions: leaves },
      orBlock: { conditions: [] }
    };
  }

  const leaf = config.condition && typeof config.condition === 'object' ? config.condition : null;
  if (leaf && (leaf.field || leaf.operator)) {
    return {
      blockCombinator: 'AND',
      andBlock: {
        conditions: [
          {
            field: leaf.field || '',
            operator: leaf.operator || 'equals',
            valueMode: String(leaf.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw',
            value: leaf.value ?? '',
            expression: leaf.expression != null ? String(leaf.expression) : ''
          }
        ]
      },
      orBlock: { conditions: [] }
    };
  }

  if (config.field && config.operator) {
    return {
      blockCombinator: 'AND',
      andBlock: {
        conditions: [
          {
            field: config.field,
            operator: config.operator,
            valueMode: String(config.valueMode || 'raw').toLowerCase() === 'expression' ? 'expression' : 'raw',
            value: config.value ?? '',
            expression: config.expression != null ? String(config.expression) : ''
          }
        ]
      },
      orBlock: { conditions: [] }
    };
  }

  return {
    blockCombinator: 'AND',
    andBlock: { conditions: [] },
    orBlock: { conditions: [] }
  };
}

function evaluateBlock(conditions, mode, event, dataBag) {
  const leaves = Array.isArray(conditions) ? conditions.filter((c) => c?.field && c?.operator) : [];
  if (!leaves.length) return null;
  const results = leaves.map((leaf) => evaluateLeaf(leaf, event, dataBag));
  return mode === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

/**
 * Evaluate two-block condition group.
 * Block 1 (AND) + Block 2 (OR), combined by blockCombinator.
 */
function evaluateConditionGroup(group, event, dataBag) {
  if (!group || typeof group !== 'object') return false;

  const andResult = evaluateBlock(group.andBlock?.conditions, 'AND', event, dataBag);
  const orResult = evaluateBlock(group.orBlock?.conditions, 'OR', event, dataBag);
  const parts = [andResult, orResult].filter((v) => v !== null);
  if (!parts.length) return false;

  const between = normalizeCombinator(group.blockCombinator);
  return between === 'OR' ? parts.some(Boolean) : parts.every(Boolean);
}

/**
 * Evaluate IF node config against execution context.
 * @returns {{ ok: true, result: boolean } | { ok: false, error: string }}
 */
function evaluateProcessCondition(config, context = {}) {
  const { event = {}, dataBag = {} } = context;

  if (typeof config?.condition === 'boolean') {
    return { ok: true, result: config.condition };
  }
  if (typeof config === 'boolean') {
    return { ok: true, result: config };
  }

  const group = normalizeConditionGroup(config);
  const andCount = group.andBlock.conditions.filter((c) => c?.field && c?.operator).length;
  const orCount = group.orBlock.conditions.filter((c) => c?.field && c?.operator).length;
  if (!andCount && !orCount) {
    return { ok: false, error: 'Condition requires at least one clause' };
  }

  try {
    return { ok: true, result: evaluateConditionGroup(group, event, dataBag) };
  } catch (err) {
    return { ok: false, error: `Condition evaluation failed: ${err.message}` };
  }
}

module.exports = {
  resolveFieldValue,
  resolveLeafCompareValue,
  evaluateLeaf,
  normalizeCombinator,
  normalizeConditionGroup,
  evaluateConditionGroup,
  evaluateProcessCondition,
  conditionGroupToMongoFilter,
  leafToMongoClause,
  mongoFieldKey,
  emptyLeaf
};
