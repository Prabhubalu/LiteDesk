const { resolvePhysicalField } = require('./analyticsJoinPipeline');

const AGGREGATION_FN_MAP = Object.freeze({
  sum: '$sum',
  avg: '$avg',
  average: '$avg',
  count: '$sum',
  min: '$min',
  max: '$max',
});

const BLANK_LABEL = '(blank)';

function formatPivotCellKey(value) {
  if (value === null || value === undefined || value === '') return BLANK_LABEL;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildPivotColumnLabel(columnFields, row) {
  if (columnFields.length === 0) return 'Value';
  if (columnFields.length === 1) return formatPivotCellKey(row[columnFields[0]]);
  return columnFields.map((field) => formatPivotCellKey(row[field])).join(' / ');
}

function sanitizePivotColumnKey(label) {
  const safe = String(label)
    .replace(/[^a-zA-Z0-9_+-]/g, '_')
    .replace(/^(\d)/, '_$1');
  return safe || '_value';
}

function assignPivotColumnKey(label, usedKeys) {
  let key = sanitizePivotColumnKey(label);
  let suffix = 1;
  while (usedKeys.has(key)) {
    key = `${sanitizePivotColumnKey(label)}_${suffix}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

function outputKeyForAggregation(agg) {
  const fn = String(agg.fn || 'count').toLowerCase();
  const field = agg.field || 'rows';
  return agg.label || `${field}_${fn}`;
}

function buildMatrixAggregatePipeline(report, match, primaryModule, helpers) {
  const { normalizeGroupFields, normalizeAggregations, buildSortStage } = helpers;

  const rowFieldKeys = normalizeGroupFields(report.rowGroups);
  const colFieldKeys = normalizeGroupFields(report.columnGroups);

  if (colFieldKeys.length === 0) {
    return null;
  }

  const rowFields = rowFieldKeys.map((field) => resolvePhysicalField(primaryModule, field));
  const colFields = colFieldKeys.map((field) => resolvePhysicalField(primaryModule, field));
  const allGroupFields = [...rowFields, ...colFields];

  const aggregations = normalizeAggregations(report.aggregations);
  if (aggregations.length === 0) {
    aggregations.push({ field: '_id', fn: 'count', label: 'count' });
  }

  const groupId =
    allGroupFields.length === 0
      ? null
      : allGroupFields.length === 1
        ? `$${allGroupFields[0]}`
        : Object.fromEntries(allGroupFields.map((field) => [field, `$${field}`]));

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
  if (allGroupFields.length === 1 && groupId) {
    project[allGroupFields[0]] = '$_id';
  } else if (groupId && typeof groupId === 'object') {
    for (const field of allGroupFields) {
      project[field] = `$_id.${field}`;
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

  const metricKeys = aggregations.length
    ? aggregations.map(outputKeyForAggregation)
    : ['count'];

  return {
    pipeline,
    rowFieldKeys,
    colFieldKeys,
    metricKeys,
  };
}

function pivotMatrixResult(flatRows, options = {}) {
  const {
    rowFields = [],
    columnFields = [],
    metricKeys = ['count'],
    showGrandTotal = true,
  } = options;

  if (!columnFields.length || !flatRows.length) {
    return null;
  }

  const usedKeys = new Set([...rowFields, '_grandTotal', ...metricKeys.map((key) => `_total__${key}`)]);
  const pivotColumns = [];
  const pivotColumnByLabel = new Map();

  for (const row of flatRows) {
    const label = buildPivotColumnLabel(columnFields, row);
    if (!pivotColumnByLabel.has(label)) {
      const filterValues = Object.fromEntries(columnFields.map((field) => [field, row[field]]));
      const key = assignPivotColumnKey(label, usedKeys);
      const entry = { key, label, filterValues };
      pivotColumnByLabel.set(label, entry);
      pivotColumns.push(entry);
    }
  }

  pivotColumns.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const rowMap = new Map();

  for (const flat of flatRows) {
    const rowKey = rowFields.map((field) => formatPivotCellKey(flat[field])).join('\u0001');
    if (!rowMap.has(rowKey)) {
      const entry = {};
      for (const field of rowFields) {
        entry[field] = flat[field];
      }
      for (const pivotCol of pivotColumns) {
        for (const metricKey of metricKeys) {
          const cellKey =
            metricKeys.length === 1 ? pivotCol.key : `${pivotCol.key}__${metricKey}`;
          entry[cellKey] = null;
        }
      }
      if (showGrandTotal) {
        if (metricKeys.length === 1) {
          entry._grandTotal = 0;
        } else {
          for (const metricKey of metricKeys) {
            entry[`_total__${metricKey}`] = 0;
          }
        }
      }
      rowMap.set(rowKey, entry);
    }

    const entry = rowMap.get(rowKey);
    const label = buildPivotColumnLabel(columnFields, flat);
    const pivotCol = pivotColumnByLabel.get(label);

    for (const metricKey of metricKeys) {
      const cellKey =
        metricKeys.length === 1 ? pivotCol.key : `${pivotCol.key}__${metricKey}`;
      const value = flat[metricKey];
      entry[cellKey] = value;

      if (showGrandTotal) {
        const totalKey =
          metricKeys.length === 1 ? '_grandTotal' : `_total__${metricKey}`;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          entry[totalKey] = (Number(entry[totalKey]) || 0) + numeric;
        }
      }
    }
  }

  const columns = [
    ...rowFields.map((key) => ({ key, label: key, role: 'row' })),
    ...pivotColumns.flatMap((pivotCol) =>
      metricKeys.length === 1
        ? [{ key: pivotCol.key, label: pivotCol.label, role: 'pivot' }]
        : metricKeys.map((metricKey) => ({
            key: `${pivotCol.key}__${metricKey}`,
            label: `${pivotCol.label} (${metricKey})`,
            role: 'pivot',
          })),
    ),
  ];

  if (showGrandTotal) {
    if (metricKeys.length === 1) {
      columns.push({ key: '_grandTotal', label: 'Total', role: 'total' });
    } else {
      for (const metricKey of metricKeys) {
        columns.push({
          key: `_total__${metricKey}`,
          label: `Total (${metricKey})`,
          role: 'total',
        });
      }
    }
  }

  const rows = [...rowMap.values()];
  let grandTotalRow = null;

  if (showGrandTotal && rows.length) {
    grandTotalRow = {};
    if (rowFields.length) {
      grandTotalRow[rowFields[0]] = 'Total';
      for (let index = 1; index < rowFields.length; index += 1) {
        grandTotalRow[rowFields[index]] = null;
      }
    }
    for (const pivotCol of pivotColumns) {
      for (const metricKey of metricKeys) {
        const cellKey =
          metricKeys.length === 1 ? pivotCol.key : `${pivotCol.key}__${metricKey}`;
        grandTotalRow[cellKey] = rows.reduce((sum, row) => {
          const numeric = Number(row[cellKey]);
          return Number.isFinite(numeric) ? sum + numeric : sum;
        }, 0);
      }
    }
    if (metricKeys.length === 1) {
      grandTotalRow._grandTotal = rows.reduce(
        (sum, row) => sum + (Number(row._grandTotal) || 0),
        0,
      );
    } else {
      for (const metricKey of metricKeys) {
        const totalKey = `_total__${metricKey}`;
        grandTotalRow[totalKey] = rows.reduce(
          (sum, row) => sum + (Number(row[totalKey]) || 0),
          0,
        );
      }
    }
  }

  return {
    rows,
    columns,
    grandTotalRow,
    matrixLayout: {
      rowFields,
      columnFields,
      metricKeys,
      pivotColumns,
    },
  };
}

function isMatrixReport(report) {
  const rawType = String(report?.type || '').toLowerCase();
  const columnFields = helpersNormalizeGroupFields(report?.columnGroups);
  return ['matrix', 'pivot'].includes(rawType) || columnFields.length > 0;
}

function helpersNormalizeGroupFields(groups) {
  if (!groups) return [];
  const list = Array.isArray(groups) ? groups : [];
  return list
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object' && entry.field) return String(entry.field).trim();
      return null;
    })
    .filter(Boolean);
}

function hasMatrixDrillFilters(matrixDrill) {
  if (!matrixDrill || typeof matrixDrill !== 'object') return false;
  const rowCount = Object.keys(matrixDrill.rowFilters || {}).length;
  const colCount = Object.keys(matrixDrill.columnFilters || {}).length;
  return rowCount + colCount > 0;
}

function buildMatrixDrillFilterAst(matrixDrill) {
  const children = [];

  const appendFilters = (filters) => {
    for (const [fieldKey, value] of Object.entries(filters || {})) {
      if (!fieldKey) continue;
      if (value === null || value === undefined || value === '') {
        children.push({ fieldKey, operator: 'is_empty', value: null });
      } else {
        children.push({ fieldKey, operator: 'eq', value });
      }
    }
  };

  appendFilters(matrixDrill.rowFilters);
  appendFilters(matrixDrill.columnFilters);

  if (!children.length) return null;
  return { logic: 'AND', children };
}

function resolveDrillSelectedFields(report, config, normalizeSelectedFields, normalizeGroupFields) {
  const selected = normalizeSelectedFields(report.selectedFields);
  if (selected.length) return selected;

  const keys = new Set([
    ...normalizeGroupFields(report.rowGroups),
    ...normalizeGroupFields(report.columnGroups),
    ...(config.defaultFields || ['name']),
  ]);

  return [...keys].map((field) => ({ field, role: 'dimension', label: field }));
}

module.exports = {
  BLANK_LABEL,
  formatPivotCellKey,
  buildMatrixAggregatePipeline,
  pivotMatrixResult,
  isMatrixReport,
  helpersNormalizeGroupFields,
  hasMatrixDrillFilters,
  buildMatrixDrillFilterAst,
  resolveDrillSelectedFields,
};
