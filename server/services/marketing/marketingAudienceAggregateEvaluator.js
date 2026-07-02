'use strict';

const {
  compileGroupNode,
  queryMatchingRecords
} = require('./marketingAudienceFieldCompiler');
const { expandPrimaryToTargetIds } = require('./marketingAudienceLinkResolver');
const { AGGREGATE_PRIMARY_BATCH_SIZE } = require('./marketingAudienceConstants');

const NUMERIC_AGGREGATE_FUNCTIONS = new Set(['count', 'sum', 'avg', 'min', 'max']);

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function readNumericField(record, fieldKey) {
  if (!record || !fieldKey) return null;
  const raw = record[fieldKey];
  if (raw == null || raw === '') return null;
  return toNumber(raw);
}

function computeAggregateMetric(fn, records, fieldKey) {
  const normalizedFn = String(fn || 'count').toLowerCase();

  if (normalizedFn === 'count') {
    return records.length;
  }

  const values = records
    .map((row) => readNumericField(row, fieldKey))
    .filter((value) => value != null);

  if (values.length === 0) return 0;

  if (normalizedFn === 'sum') {
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (normalizedFn === 'avg') {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  if (normalizedFn === 'min') {
    return Math.min(...values);
  }
  if (normalizedFn === 'max') {
    return Math.max(...values);
  }

  return records.length;
}

function compareAggregateMetric(metric, operator, value) {
  const op = String(operator || 'gte').toLowerCase();
  const metricNum = toNumber(metric);
  if (metricNum == null) return false;

  if (op === 'eq') return metricNum === toNumber(value);
  if (op === 'neq') return metricNum !== toNumber(value);
  if (op === 'gt') return metricNum > toNumber(value);
  if (op === 'gte') return metricNum >= toNumber(value);
  if (op === 'lt') return metricNum < toNumber(value);
  if (op === 'lte') return metricNum <= toNumber(value);
  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    const low = toNumber(value[0]);
    const high = toNumber(value[1]);
    if (low == null || high == null) return false;
    return metricNum >= low && metricNum <= high;
  }

  return false;
}

function buildRelatedFilterClause(node, targetModuleKey, context) {
  const children = node.filter?.children || [];
  if (!children.length) return null;

  return compileGroupNode(
    {
      logic: node.filter?.logic || 'AND',
      type: 'group',
      children
    },
    targetModuleKey,
    context
  );
}

async function evaluateNumericAggregateRule(
  organizationId,
  primaryModuleKey,
  node,
  allPrimaryIds,
  context = {}
) {
  const fn = String(node.function || 'count').toLowerCase();
  if (!NUMERIC_AGGREGATE_FUNCTIONS.has(fn)) return [];

  const relationshipPath = Array.isArray(node.relationshipPath) ? node.relationshipPath : [];
  const targetModuleKey = String(node.targetModuleKey || '').toLowerCase();
  if (!relationshipPath.length || !targetModuleKey) return [];

  const filterClause = buildRelatedFilterClause(node, targetModuleKey, context);
  const fieldKey = String(node.fieldKey || '').trim();
  const selectFields =
    fn === 'count' ? '_id' : `_id ${fieldKey || 'amount'}`.trim();

  const matched = [];

  for (const primaryBatch of chunkArray(allPrimaryIds, AGGREGATE_PRIMARY_BATCH_SIZE)) {
    const { primaryToTargetIds } = await expandPrimaryToTargetIds(
      organizationId,
      primaryModuleKey,
      relationshipPath,
      primaryBatch
    );

    const allTargetIds = new Set();
    for (const targetIds of primaryToTargetIds.values()) {
      for (const id of targetIds) allTargetIds.add(String(id));
    }

    const records = await queryMatchingRecords(
      organizationId,
      targetModuleKey,
      [...allTargetIds],
      filterClause,
      selectFields
    );

    const recordsById = new Map(records.map((row) => [String(row._id), row]));

    for (const primaryId of primaryBatch) {
      const targetIds = primaryToTargetIds.get(String(primaryId)) || [];
      const relatedRecords = targetIds
        .map((id) => recordsById.get(String(id)))
        .filter(Boolean);

      const metric = computeAggregateMetric(fn, relatedRecords, fieldKey);
      if (compareAggregateMetric(metric, node.operator, node.value)) {
        matched.push(String(primaryId));
      }
    }
  }

  return matched;
}

module.exports = {
  computeAggregateMetric,
  compareAggregateMetric,
  evaluateNumericAggregateRule,
  NUMERIC_AGGREGATE_FUNCTIONS
};
