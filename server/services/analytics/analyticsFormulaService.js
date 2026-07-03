const FORMULA_SAFE_PATTERN = /^[\d\s+\-*/()._a-zA-Z]+$/;

function rowFieldValue(row, field) {
  if (!row || !field) return 0;
  const value = row[field];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFormulaEvaluator(expression, fieldNames) {
  const safe = String(expression || '').trim();
  if (!safe || !FORMULA_SAFE_PATTERN.test(safe)) {
    return null;
  }

  let body = safe;
  for (const name of fieldNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(new RegExp(`\\b${escaped}\\b`, 'g'), `rowFieldValue(row, ${JSON.stringify(name)})`);
  }

  if (!FORMULA_SAFE_PATTERN.test(body.replace(/rowFieldValue\(row, "[^"]+"\)/g, '0'))) {
    return null;
  }

  try {
    // eslint-disable-next-line no-new-func
    return new Function('row', 'rowFieldValue', `return (${body});`);
  } catch {
    return null;
  }
}

function applyCalculatedFields(result, calculatedFields) {
  if (!calculatedFields?.length || !result?.rows) return result;

  const defs = calculatedFields
    .map((entry) => {
      const key = entry.key || entry.field || entry.label;
      const expression = entry.expression || entry.formula;
      if (!key || !expression) return null;
      return { key, label: entry.label || key, expression: String(expression) };
    })
    .filter(Boolean);

  if (!defs.length) return result;

  const columns = [...(result.columns || [])];
  const rows = (result.rows || []).map((row) => ({ ...row }));

  for (const def of defs) {
    const fieldNames = Object.keys(rows[0] || {});
    const evaluate = buildFormulaEvaluator(def.expression, fieldNames);
    if (!evaluate) continue;

    for (const row of rows) {
      try {
        row[def.key] = evaluate(row, rowFieldValue);
      } catch {
        row[def.key] = null;
      }
    }

    if (!columns.some((col) => col.key === def.key)) {
      columns.push({
        key: def.key,
        label: def.label,
        type: 'number',
        moduleKey: result.meta?.moduleKey,
        calculated: true,
      });
    }
  }

  return { ...result, columns, rows };
}

module.exports = {
  applyCalculatedFields,
};
