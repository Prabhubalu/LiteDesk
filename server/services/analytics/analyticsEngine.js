const mongoose = require('mongoose');
const { applyFilterQueryToMongoQuery } = require('../../utils/filterQueryCompiler');
const { getAnalyticsModuleConfig } = require('./analyticsModuleRegistry');
const { resolveModuleDataAccess } = require('./analyticsAccessGuard');
const {
  resolvePhysicalField,
  buildJoinStages,
  remapRows,
  remapColumns,
  partitionMatrixDrillFilters,
  buildPostJoinDrillMatchStage,
} = require('./analyticsJoinPipeline');
const { applyCalculatedFields } = require('./analyticsFormulaService');
const { applyFieldLevelSecurityToResult } = require('./analyticsFieldAccess');
const { resolveReferenceDisplayValues } = require('./analyticsReferenceResolver');
const {
  buildMatrixAggregatePipeline,
  pivotMatrixResult,
  isMatrixReport,
  hasMatrixDrillFilters,
  buildMatrixDrillFilterAst,
  resolveDrillSelectedFields,
} = require('./analyticsMatrixPivot');

const REPORT_TYPE_ALIASES = Object.freeze({
  joined: 'tabular',
  cross_module: 'tabular',
  ad_hoc: 'tabular',
  snapshot: 'tabular',
  trend: 'summary',
  matrix: 'summary',
  pivot: 'summary',
  historical: 'summary',
});

const AGGREGATION_FN_MAP = Object.freeze({
  sum: '$sum',
  avg: '$avg',
  average: '$avg',
  count: '$sum',
  min: '$min',
  max: '$max',
});

function normalizeFieldKey(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (entry && typeof entry === 'object' && entry.field) return String(entry.field).trim();
  return null;
}

function normalizeGroupFields(rowGroups) {
  if (!rowGroups) return [];
  const list = Array.isArray(rowGroups) ? rowGroups : [];
  return list.map(normalizeFieldKey).filter(Boolean);
}

function normalizeSelectedFields(selectedFields) {
  if (!selectedFields) return [];
  const list = Array.isArray(selectedFields) ? selectedFields : [];
  return list.map((entry) => {
    const field = normalizeFieldKey(entry);
    if (!field) return null;
    const role = typeof entry === 'object' && entry.role ? entry.role : 'dimension';
    const label =
      typeof entry === 'object' && entry.label ? entry.label : field;
    return { field, role, label };
  }).filter(Boolean);
}

function normalizeAggregations(aggregations) {
  if (!aggregations) return [];
  const list = Array.isArray(aggregations) ? aggregations : [];
  return list
    .map((agg) => {
      const field = normalizeFieldKey(agg) || (agg.field ? String(agg.field).trim() : null);
      const fn = String(agg.fn || agg.aggregation || 'count').toLowerCase();
      const label = agg.label || `${fn}_${field || 'rows'}`;
      return { field, fn, label };
    })
    .filter((a) => a.field || a.fn === 'count');
}

function buildFilterTreeAst(report) {
  if (!report.filterTree) return null;
  if (report.filterTree.fieldKey || report.filterTree.children) {
    return report.filterTree;
  }
  if (report.filterLogic && Array.isArray(report.filterTree)) {
    return { logic: report.filterLogic, children: report.filterTree };
  }
  return report.filterTree;
}

function buildBaseMatch(report, context) {
  const moduleKey = report.primaryModule;
  const config = getAnalyticsModuleConfig(moduleKey);
  if (!config) {
    const err = new Error(`Unsupported module: ${moduleKey}`);
    err.code = 'UNSUPPORTED_MODULE';
    throw err;
  }

  const access = resolveModuleDataAccess(context.user, moduleKey, {
    appKey: context.appKey,
    orgContext: context.orgContext,
  });

  if (!access.allowed) {
    const err = new Error('Not authorized to read module data for this report');
    err.code = access.reason || 'FORBIDDEN';
    err.statusCode = 403;
    throw err;
  }

  let match;
  const normalizedModule = String(moduleKey || '').toLowerCase();

  if (normalizedModule === 'organizations') {
    match = { isTenant: { $ne: true } };
  } else {
    match = {
      organizationId: new mongoose.Types.ObjectId(String(context.organizationId)),
    };
    if (config.tenantScopeMatch) {
      match = { ...match, ...config.tenantScopeMatch };
    }
  }

  if (config.excludeTrash) {
    match.deletedAt = null;
  }

  if (access.ownershipMatch) {
    match = { ...match, ...access.ownershipMatch };
  }

  const filterAst = buildFilterTreeAst(report);
  if (filterAst) {
    match = applyFilterQueryToMongoQuery(match, filterAst, moduleKey, {
      userId: context.user?._id,
    });
  }

  if (context.runtimeFilters && typeof context.runtimeFilters === 'object') {
    match = applyFilterQueryToMongoQuery(match, context.runtimeFilters, moduleKey, {
      userId: context.user?._id,
    });
  }

  return { match, config, moduleKey };
}

function buildSortStage(report, primaryModule) {
  const sorting = report.sorting;
  if (!sorting) return null;

  const entries = Array.isArray(sorting) ? sorting : [{ field: report.sortBy, order: report.sortOrder }];
  const sortDoc = {};
  for (const entry of entries) {
    const field = normalizeFieldKey(entry);
    if (!field) continue;
    const physical = resolvePhysicalField(primaryModule, field);
    const order = String(entry.order || entry.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    sortDoc[physical] = order;
  }
  return Object.keys(sortDoc).length ? { $sort: sortDoc } : null;
}

function aggregationAccumulator(agg) {
  const fn = String(agg.fn || 'count').toLowerCase();
  if (fn === 'count' && (!agg.field || agg.field === '_id' || agg.field === '*')) {
    return { $sum: 1 };
  }
  const op = AGGREGATION_FN_MAP[fn] || '$sum';
  if (fn === 'count') {
    return { $sum: { $cond: [{ $ifNull: [`$${agg.field}`, false] }, 1, 0] } };
  }
  return { [op]: `$${agg.field}` };
}

function outputKeyForAggregation(agg) {
  const fn = String(agg.fn || 'count').toLowerCase();
  const field = agg.field || 'rows';
  return agg.label || `${field}_${fn}`;
}

const matrixPipelineHelpers = {
  normalizeGroupFields,
  normalizeAggregations,
  buildSortStage,
};

function buildSummaryPipeline(report, match, primaryModule) {
  const groupFields = normalizeGroupFields(report.rowGroups).map((f) =>
    resolvePhysicalField(primaryModule, f)
  );
  const aggregations = normalizeAggregations(report.aggregations);

  if (groupFields.length === 0 && aggregations.length === 0) {
    aggregations.push({ field: '_id', fn: 'count', label: 'count' });
  }

  const groupId =
    groupFields.length === 0
      ? null
      : groupFields.length === 1
        ? `$${groupFields[0]}`
        : Object.fromEntries(groupFields.map((f) => [f, `$${f}`]));

  const $group = { _id: groupId };
  for (const agg of aggregations) {
    const fn = String(agg.fn || 'count').toLowerCase();
    if (fn === 'count' && (!agg.field || agg.field === '_id' || agg.field === '*')) {
      $group[outputKeyForAggregation(agg)] = { $sum: 1 };
      continue;
    }
    const physicalField = resolvePhysicalField(primaryModule, agg.field);
    const op = AGGREGATION_FN_MAP[fn] || '$sum';
    if (fn === 'count') {
      $group[outputKeyForAggregation(agg)] = {
        $sum: { $cond: [{ $ifNull: [`$${physicalField}`, false] }, 1, 0] },
      };
    } else {
      $group[outputKeyForAggregation(agg)] = { [op]: `$${physicalField}` };
    }
  }
  if (Object.keys($group).length === 1) {
    $group.count = { $sum: 1 };
  }

  const pipeline = [{ $match: match }, { $group }];

  const project = { _id: 0 };
  if (groupFields.length === 1) {
    project[groupFields[0]] = '$_id';
  } else if (groupFields.length > 1 && groupId && typeof groupId === 'object') {
    for (const f of groupFields) {
      project[f] = `$_id.${f}`;
    }
  }
  for (const agg of aggregations) {
    project[outputKeyForAggregation(agg)] = 1;
  }
  if (!aggregations.length) {
    project.count = 1;
  }
  pipeline.push({ $project: project });

  const sortStage = buildSortStage(report, primaryModule);
  if (sortStage) pipeline.push(sortStage);

  const outputGroupFields = normalizeGroupFields(report.rowGroups);
  const outputColumns = [
    ...outputGroupFields,
    ...(aggregations.length ? aggregations.map(outputKeyForAggregation) : ['count']),
  ];

  return { pipeline, columns: outputColumns };
}

function buildTabularPipeline(report, match, limit, config, primaryModule) {
  const selected = normalizeSelectedFields(report.selectedFields);
  const fields =
    selected.length > 0
      ? selected.map((s) => s.field)
      : config.defaultFields || ['_id'];

  const project = { _id: 1 };
  for (const field of fields) {
    const physical = resolvePhysicalField(primaryModule, field);
    project[physical] = 1;
  }

  const pipeline = [{ $match: match }, { $project: project }];
  const sortStage = buildSortStage(report, primaryModule);
  if (sortStage) pipeline.push(sortStage);
  pipeline.push({ $limit: limit });
  return { pipeline, columns: fields };
}

function rowsToColumnMeta(columns, moduleKey) {
  return columns.map((key) => ({
    key,
    label: key,
    type: inferColumnType(key),
    moduleKey,
  }));
}

function inferColumnType(key) {
  const bareKey = String(key || '').includes('.')
    ? key.slice(key.indexOf('.') + 1)
    : String(key || '');
  const normalized = bareKey.toLowerCase();
  if (
    normalized === 'assignedto' ||
    normalized === 'createdby' ||
    normalized === 'updatedby' ||
    normalized === 'modifiedby' ||
    normalized === 'ownerid' ||
    normalized === 'submittedby'
  ) {
    return 'user';
  }
  if (key.includes('Date') || key.endsWith('At')) return 'date';
  if (['amount', 'probability', 'version', 'count'].some((k) => key.includes(k))) return 'number';
  return 'string';
}

function applyExceptionFilter(result) {
  const rows = result.rows || [];
  if (rows.length < 3) return result;

  const numericKeys = (result.columns || [])
    .map((col) => col.key)
    .filter((key) => rows.some((row) => typeof row[key] === 'number'));

  if (!numericKeys.length) return result;

  const stats = {};
  for (const key of numericKeys) {
    const values = rows.map((row) => Number(row[key])).filter((v) => Number.isFinite(v));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    stats[key] = { mean, threshold: mean + 2 * Math.sqrt(variance) };
  }

  const filtered = rows.filter((row) =>
    numericKeys.some((key) => {
      const value = Number(row[key]);
      return Number.isFinite(value) && value > stats[key].threshold;
    }),
  );

  return {
    ...result,
    rows: filtered,
    meta: { ...result.meta, exceptionFilterApplied: true, exceptionRowCount: filtered.length },
  };
}

function flattenSummaryRows(rows, groupFields) {
  return rows.map((row) => {
    const out = { ...row };
    if (out._id !== undefined) delete out._id;
    return out;
  });
}

async function executeMatrixDrillReport(report, context, rawType, started) {
  const rowLimit = Math.min(
    Number(context.rowLimit ?? report.rowLimit ?? 100) || 100,
    context.preview ? 100 : 500,
  );

  const { match, config, moduleKey } = buildBaseMatch(report, context);
  const Model = config.model;
  const { stages: joinStages, aliasToQualified } = await buildJoinStages(report, context);

  let drillMatch = match;
  const partitionedDrill = partitionMatrixDrillFilters(context.matrixDrill, moduleKey);
  const primaryDrill = {
    rowFilters: partitionedDrill.primaryRowFilters,
    columnFilters: partitionedDrill.primaryColumnFilters,
  };
  const joinedDrill = {
    ...partitionedDrill.joinedRowFilters,
    ...partitionedDrill.joinedColumnFilters,
  };
  const drillAst = buildMatrixDrillFilterAst(primaryDrill);
  if (drillAst) {
    drillMatch = applyFilterQueryToMongoQuery(drillMatch, drillAst, moduleKey, {
      userId: context.user?._id,
    });
  }
  if (context.runtimeFilters) {
    drillMatch = applyFilterQueryToMongoQuery(drillMatch, context.runtimeFilters, moduleKey, {
      userId: context.user?._id,
    });
  }

  const drillReport = {
    ...report,
    type: 'tabular',
    selectedFields: resolveDrillSelectedFields(
      report,
      config,
      normalizeSelectedFields,
      normalizeGroupFields,
    ),
  };

  const { pipeline: corePipeline, columns: tabularColumns } = buildTabularPipeline(
    drillReport,
    drillMatch,
    rowLimit,
    config,
    moduleKey,
  );
  const postJoinDrillStage = buildPostJoinDrillMatchStage(joinedDrill, moduleKey);
  const pipeline = [
    corePipeline[0],
    ...joinStages,
    ...(postJoinDrillStage ? [postJoinDrillStage] : []),
    ...corePipeline.slice(1),
  ];
  let rows = await Model.aggregate(pipeline);
  let columns = tabularColumns;
  rows = remapRows(rows, aliasToQualified);
  columns = remapColumns(columns, moduleKey, aliasToQualified);

  const columnMeta = rowsToColumnMeta(columns, moduleKey);
  const executionMs = Date.now() - started;

  let result = {
    columns: columnMeta,
    rows,
    meta: {
      totalRows: rows.length,
      truncated: rows.length >= rowLimit,
      executionMs,
      reportId: String(report._id || ''),
      reportVersion: report.version || 1,
      moduleKey,
      type: rawType,
      drillDown: true,
      drillContext: context.matrixDrill,
      joinedModules: Object.values(aliasToQualified).map((q) => q.split('.')[0]).filter(Boolean),
    },
  };

  if (Array.isArray(report.calculatedFields) && report.calculatedFields.length) {
    result = applyCalculatedFields(result, report.calculatedFields);
  }

  if (context.organizationId) {
    result = await resolveReferenceDisplayValues(result, report, context.organizationId);
  }

  if (context.user && context.organizationId) {
    result = await applyFieldLevelSecurityToResult(
      result,
      context.user,
      moduleKey,
      report.relatedModules || [],
      context.organizationId,
    );
  }

  return result;
}

/**
 * Execute an analytics report definition.
 * @param {object} report - AnalyticsReport document or lean object
 * @param {object} context
 */
async function executeAnalyticsReport(report, context = {}) {
  const started = Date.now();
  const rawType = String(report.type || 'tabular').toLowerCase();

  if (hasMatrixDrillFilters(context.matrixDrill)) {
    return executeMatrixDrillReport(report, context, rawType, started);
  }

  const reportType = rawType === 'exception' ? 'exception' : (REPORT_TYPE_ALIASES[rawType] || rawType);
  const rowLimit = Math.min(
    Number(context.rowLimit ?? report.rowLimit ?? 1000) || 1000,
    context.preview ? 500 : 10000
  );

  const { match, config, moduleKey } = buildBaseMatch(report, context);
  const Model = config.model;
  const { stages: joinStages, aliasToQualified } = await buildJoinStages(report, context);

  let columns = [];
  let rows = [];
  let matrixMeta = null;
  let grandTotalRow = null;
  let pivotedColumnDefs = null;

  const matrixPlan = isMatrixReport(report)
    ? buildMatrixAggregatePipeline(report, match, moduleKey, matrixPipelineHelpers)
    : null;

  if (matrixPlan) {
    const pipeline = [matrixPlan.pipeline[0], ...joinStages, ...matrixPlan.pipeline.slice(1)];
    pipeline.push({ $limit: rowLimit });
    const flatRows = await Model.aggregate(pipeline);
    const remappedFlatRows = remapRows(flattenSummaryRows(flatRows, matrixPlan.rowFieldKeys), aliasToQualified);

    const pivoted = pivotMatrixResult(remappedFlatRows, {
      rowFields: remapColumns(matrixPlan.rowFieldKeys, moduleKey, aliasToQualified),
      columnFields: remapColumns(matrixPlan.colFieldKeys, moduleKey, aliasToQualified),
      metricKeys: matrixPlan.metricKeys,
      showGrandTotal: report.showGrandTotal !== false,
    });

    if (pivoted) {
      pivotedColumnDefs = pivoted.columns;
      columns = pivoted.columns.map((col) => col.key);
      rows = pivoted.rows;
      matrixMeta = pivoted.matrixLayout;
      grandTotalRow = pivoted.grandTotalRow;
    }
  } else if (reportType === 'summary' || reportType === 'kpi') {
    const { pipeline: corePipeline, columns: summaryColumns } = buildSummaryPipeline(
      report,
      match,
      moduleKey
    );
    const pipeline = [corePipeline[0], ...joinStages, ...corePipeline.slice(1)];
    pipeline.push({ $limit: rowLimit });
    rows = await Model.aggregate(pipeline);

    columns = summaryColumns;
    rows = remapRows(flattenSummaryRows(rows, columns), aliasToQualified);
    columns = remapColumns(columns, moduleKey, aliasToQualified);
  } else {
    const { pipeline: corePipeline, columns: tabularColumns } = buildTabularPipeline(
      report,
      match,
      rowLimit,
      config,
      moduleKey
    );
    const pipeline = [corePipeline[0], ...joinStages, ...corePipeline.slice(1)];
    rows = await Model.aggregate(pipeline);
    columns = tabularColumns;
    rows = remapRows(rows, aliasToQualified);
    columns = remapColumns(columns, moduleKey, aliasToQualified);
  }

  const columnMeta = pivotedColumnDefs
    ? pivotedColumnDefs.map((col) => ({
        key: col.key,
        label: col.label || col.key,
        type: inferColumnType(col.key),
        moduleKey,
        ...(col.role ? { role: col.role } : {}),
      }))
    : rowsToColumnMeta(columns, moduleKey);
  const executionMs = Date.now() - started;

  let result = {
    columns: columnMeta,
    rows,
    meta: {
      totalRows: rows.length,
      truncated: rows.length >= rowLimit,
      executionMs,
      reportId: String(report._id || ''),
      reportVersion: report.version || 1,
      moduleKey,
      type: rawType,
      joinedModules: Object.values(aliasToQualified).map((q) => q.split('.')[0]).filter(Boolean),
      ...(matrixMeta ? { matrixLayout: matrixMeta } : {}),
      ...(grandTotalRow ? { grandTotalRow } : {}),
    },
  };

  if (rawType === 'exception') {
    result = applyExceptionFilter(result);
  }

  if (Array.isArray(report.calculatedFields) && report.calculatedFields.length) {
    result = applyCalculatedFields(result, report.calculatedFields);
  }

  if (context.organizationId) {
    result = await resolveReferenceDisplayValues(result, report, context.organizationId);
  }

  if (context.user && context.organizationId) {
    result = await applyFieldLevelSecurityToResult(
      result,
      context.user,
      moduleKey,
      report.relatedModules || [],
      context.organizationId
    );
  }

  return result;
}

module.exports = {
  executeAnalyticsReport,
  normalizeGroupFields,
  normalizeAggregations,
  normalizeSelectedFields,
  buildBaseMatch,
  outputKeyForAggregation,
  buildSortStage,
};
