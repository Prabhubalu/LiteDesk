function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveColumnKey(result, fieldHint) {
  if (!result?.columns?.length) return null;
  const hint = String(fieldHint || '').trim();
  if (hint) {
    const match = result.columns.find(
      (col) => col.key === hint || col.field === hint || col.label === hint
    );
    if (match) return match.key;
    return hint;
  }
  const row = result.rows?.[0];
  if (!row) return null;
  for (const col of result.columns) {
    if (toNumber(row[col.key]) !== null) return col.key;
  }
  return result.columns[0]?.key || null;
}

function extractMetricFromResult(result, metricField, columnMapping, kpiValueField) {
  const hint =
    metricField ||
    kpiValueField ||
    columnMapping?.metric ||
    columnMapping?.value ||
    null;
  const key = resolveColumnKey(result, hint);
  if (!key) return null;
  const row = result.rows?.[0];
  if (!row) return null;
  return toNumber(row[key]);
}

function evaluateThresholdOperator(value, operator, threshold) {
  if (value === null) return false;
  switch (operator) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}

function formatOperatorLabel(operator) {
  const labels = {
    lt: '<',
    lte: '≤',
    gt: '>',
    gte: '≥',
    eq: '=',
  };
  return labels[operator] || operator;
}

module.exports = {
  toNumber,
  extractMetricFromResult,
  evaluateThresholdOperator,
  formatOperatorLabel,
};
