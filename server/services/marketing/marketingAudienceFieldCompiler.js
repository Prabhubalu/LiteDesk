'use strict';

const { compileNode, parseFilterQueryParam } = require('../../utils/filterQueryCompiler');
const { getModelForModuleKey } = require('../../utils/assignmentRecordLoader');
const { buildModuleBaseQuery, toObjectId } = require('./marketingAudienceLinkResolver');
const { ID_BATCH_SIZE } = require('./marketingAudienceConstants');

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function resolveRelativeDateRange(operator, value) {
  const now = new Date();
  const op = String(operator || '');

  if (op === 'today') {
    return { $gte: startOfDay(now), $lte: endOfDay(now) };
  }
  if (op === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { $gte: startOfDay(y), $lte: endOfDay(y) };
  }
  if (op === 'last_7_days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { $gte: startOfDay(start), $lte: endOfDay(now) };
  }
  if (op === 'last_30_days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { $gte: startOfDay(start), $lte: endOfDay(now) };
  }
  if (op === 'last_n_days') {
    const days = Math.max(1, parseInt(String(value || '30'), 10) || 30);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { $gte: startOfDay(start), $lte: endOfDay(now) };
  }
  if (op === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { $gte: startOfDay(start), $lte: endOfDay(end) };
  }
  if (op === 'previous_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { $gte: startOfDay(start), $lte: endOfDay(end) };
  }
  if (op === 'between_dates' && Array.isArray(value) && value.length === 2) {
    return { $gte: new Date(value[0]), $lte: new Date(value[1]) };
  }

  return null;
}

function compileExtendedRule(rule, moduleKey, context = {}) {
  const fieldKey = String(rule.fieldKey || rule.key || '').trim();
  const operator = String(rule.operator || 'is');
  const value = rule.value;

  if (!fieldKey) return null;

  if (operator === 'starts_with' && typeof value === 'string') {
    return { [fieldKey]: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' } };
  }
  if (operator === 'ends_with' && typeof value === 'string') {
    return { [fieldKey]: { $regex: `${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
  }
  if (operator === 'gt') return { [fieldKey]: { $gt: value } };
  if (operator === 'lt') return { [fieldKey]: { $lt: value } };
  if (operator === 'between' && Array.isArray(value) && value.length === 2) {
    return { [fieldKey]: { $gte: value[0], $lte: value[1] } };
  }

  const dateRange = resolveRelativeDateRange(operator, value);
  if (dateRange) {
    return { [fieldKey]: dateRange };
  }

  return compileNode({ logic: 'AND', children: [{ fieldKey, operator, value }] }, moduleKey, context);
}

function compileFieldNode(node, moduleKey, context = {}) {
  if (node?.fieldKey && !node.type) {
    return compileExtendedRule(node, moduleKey, context);
  }
  if (node?.type === 'field') {
    return compileExtendedRule(node, moduleKey, context);
  }
  return null;
}

function compileGroupNode(node, moduleKey, context = {}) {
  if (!node || !Array.isArray(node.children)) return null;

  const logic = String(node.logic || 'AND').toUpperCase() === 'OR' ? '$or' : '$and';
  const clauses = [];

  for (const child of node.children) {
    if (child?.type === 'field' || child?.fieldKey) {
      const clause = compileFieldNode(child, moduleKey, context);
      if (clause) clauses.push(clause);
      continue;
    }
    if (child?.type === 'group' || child?.logic) {
      const nested = compileGroupNode(child, moduleKey, context);
      if (nested) clauses.push(nested);
    }
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return { [logic]: clauses };
}

function compileLegacyAst(ast, moduleKey, context = {}) {
  return compileNode(ast, moduleKey, context);
}

async function queryMatchingRecordIds(organizationId, moduleKey, filterClause, limit = null) {
  const Model = getModelForModuleKey(moduleKey);
  if (!Model) return [];

  const base = buildModuleBaseQuery(organizationId, moduleKey);
  const query = { ...base };
  if (filterClause) {
    if (query.$and) {
      query.$and = [...query.$and, filterClause];
    } else {
      query.$and = [filterClause];
    }
  }

  let cursor = Model.find(query).select('_id').lean();
  if (limit) cursor = cursor.limit(limit);
  const rows = await cursor;
  return rows.map((row) => String(row._id));
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function queryMatchingRecords(organizationId, moduleKey, recordIds, filterClause, selectFields = '_id') {
  const Model = getModelForModuleKey(moduleKey);
  if (!Model) return [];

  const ids = [...new Set((recordIds || []).map(String).filter(Boolean))];
  if (ids.length === 0) return [];

  const base = buildModuleBaseQuery(organizationId, moduleKey);
  const results = [];

  for (const batch of chunkArray(ids, ID_BATCH_SIZE)) {
    const objectIds = batch.map((id) => toObjectId(id)).filter(Boolean);
    if (objectIds.length === 0) continue;

    const query = {
      ...base,
      _id: { $in: objectIds }
    };
    if (filterClause) {
      query.$and = query.$and ? [...query.$and, filterClause] : [filterClause];
    }

    const rows = await Model.find(query).select(selectFields).lean();
    results.push(...rows);
  }

  return results;
}

module.exports = {
  compileExtendedRule,
  compileFieldNode,
  compileGroupNode,
  compileLegacyAst,
  queryMatchingRecordIds,
  queryMatchingRecords
};
