/**
 * Import mapping template utilities (columnRules apply + build from snapshot mapping).
 */

function normalizeImportFieldToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} header
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }} rule
 * @param {{ value: string, label?: string }[]} fields
 */
function headerMatchesRule(header, rule, fields) {
  const hNorm = normalizeImportFieldToken(header);
  if (!hNorm || !rule?.targetFieldKey) return false;

  for (const alias of rule.sourceAliases || []) {
    if (normalizeImportFieldToken(alias) === hNorm) return true;
  }

  const target = String(rule.targetFieldKey || '').trim();
  const keyNorm = normalizeImportFieldToken(target);
  if (hNorm === keyNorm) return true;

  const field = fields.find((f) => f.value === target);
  const labelNorm = field ? normalizeImportFieldToken(field.label) : '';
  return !!(labelNorm && hNorm === labelNorm);
}

/**
 * Cross-rule alias collisions (same normalized alias → different target fields).
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }[]} columnRules
 * @param {Set<string>} [allowedKeys]
 */
function detectAliasCollisions(columnRules, allowedKeys = null) {
  const normToTargets = new Map();
  const rules = Array.isArray(columnRules) ? columnRules : [];

  for (const rule of rules) {
    const target = String(rule?.targetFieldKey || '').trim();
    if (!target) continue;
    if (allowedKeys && !allowedKeys.has(target)) continue;

    for (const alias of rule.sourceAliases || []) {
      const norm = normalizeImportFieldToken(alias);
      if (!norm) continue;
      if (!normToTargets.has(norm)) normToTargets.set(norm, new Set());
      normToTargets.get(norm).add(target);
    }
  }

  const aliasCollisions = [];
  for (const [normalizedAlias, targets] of normToTargets) {
    if (targets.size > 1) {
      aliasCollisions.push({
        normalizedAlias,
        targetFieldKeys: [...targets],
      });
    }
  }
  return aliasCollisions;
}

/**
 * @param {string} header
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }[]} columnRules
 * @param {{ value: string, label?: string }[]} fields
 * @param {Set<string>} allowedKeys
 */
function findMatchingRulesForHeader(header, columnRules, fields, allowedKeys) {
  const matches = [];
  for (const rule of columnRules || []) {
    const target = String(rule?.targetFieldKey || '').trim();
    if (!target || !allowedKeys.has(target)) continue;
    if (headerMatchesRule(header, rule, fields)) matches.push(rule);
  }
  return matches;
}

/**
 * Dedupe aliases within each rule by normalized token (keeps first literal spelling).
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }[]} columnRules
 */
function dedupeColumnRuleAliases(columnRules) {
  return (Array.isArray(columnRules) ? columnRules : []).map((rule) => {
    const targetFieldKey = String(rule?.targetFieldKey || '').trim();
    if (!targetFieldKey) return null;
    const seenNorms = new Set();
    const sourceAliases = [];
    for (const alias of rule.sourceAliases || []) {
      const literal = String(alias || '').trim();
      if (!literal) continue;
      const norm = normalizeImportFieldToken(literal);
      if (!norm || seenNorms.has(norm)) continue;
      seenNorms.add(norm);
      sourceAliases.push(literal);
    }
    if (!sourceAliases.length) return null;
    return { targetFieldKey, sourceAliases };
  }).filter(Boolean);
}

/**
 * @param {string[]} csvHeaders
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }[]} columnRules
 * @param {{ value: string, label?: string }[]} fields
 */
function applyImportMappingTemplate(csvHeaders, columnRules, fields) {
  const allowedKeys = new Set(fields.map((f) => f.value));
  const rules = dedupeColumnRuleAliases(columnRules);
  const usedTargets = new Set();
  const fieldMapping = {};
  const matched = [];
  const unmatchedHeaders = [];
  const invalidTargetFields = [];
  const staleRules = [];
  const ambiguousHeaders = [];

  const aliasCollisions = detectAliasCollisions(rules, allowedKeys);

  for (const rule of rules) {
    const target = String(rule?.targetFieldKey || '').trim();
    if (!target) continue;
    if (!allowedKeys.has(target)) {
      invalidTargetFields.push({
        targetFieldKey: target,
        sourceAliases: rule.sourceAliases || [],
      });
    }
  }

  for (const header of csvHeaders || []) {
    const matchingRules = findMatchingRulesForHeader(header, rules, fields, allowedKeys);
    const distinctTargets = [...new Set(matchingRules.map((r) => r.targetFieldKey))];

    if (distinctTargets.length > 1) {
      ambiguousHeaders.push({
        csvHeader: header,
        targetFieldKeys: distinctTargets,
      });
    }

    let chosen = '';
    for (const target of distinctTargets) {
      if (usedTargets.has(target)) continue;
      chosen = target;
      usedTargets.add(target);
      break;
    }

    fieldMapping[header] = chosen;
    if (chosen) {
      matched.push({ csvHeader: header, targetFieldKey: chosen });
    } else {
      unmatchedHeaders.push(header);
    }
  }

  const usedTargetsFromMatch = new Set(matched.map((m) => m.targetFieldKey));
  for (const rule of rules) {
    const target = String(rule?.targetFieldKey || '').trim();
    if (!target || !allowedKeys.has(target)) continue;
    if (!usedTargetsFromMatch.has(target)) {
      staleRules.push({
        targetFieldKey: target,
        sourceAliases: rule.sourceAliases || [],
      });
    }
  }

  return {
    fieldMapping,
    report: {
      matched,
      unmatchedHeaders,
      staleRules,
      invalidTargetFields,
      aliasCollisions,
      ambiguousHeaders,
    },
  };
}

/**
 * @param {Record<string, string>} fieldMapping csvHeader -> targetFieldKey
 * @param {Set<string>} [allowedFieldKeys]
 */
function buildColumnRulesFromFieldMapping(fieldMapping, allowedFieldKeys = null) {
  const byTarget = new Map();
  for (const [csvHeader, targetFieldKey] of Object.entries(fieldMapping || {})) {
    const target = String(targetFieldKey || '').trim();
    if (!target) continue;
    if (allowedFieldKeys && !allowedFieldKeys.has(target)) continue;

    if (!byTarget.has(target)) {
      byTarget.set(target, { targetFieldKey: target, sourceAliases: [] });
    }
    const alias = String(csvHeader || '').trim();
    if (!alias) continue;
    const rule = byTarget.get(target);
    const norm = normalizeImportFieldToken(alias);
    const duplicateNorm = rule.sourceAliases.some(
      (a) => normalizeImportFieldToken(a) === norm
    );
    if (!duplicateNorm) rule.sourceAliases.push(alias);
  }
  return dedupeColumnRuleAliases(Array.from(byTarget.values()));
}

/**
 * @param {{ targetFieldKey: string, sourceAliases?: string[] }[]} columnRules
 */
function detectCrossRuleAliasCollisions(columnRules) {
  return detectAliasCollisions(dedupeColumnRuleAliases(columnRules), null);
}

/**
 * @param {Record<string, string>} fieldMapping
 * @param {Set<string>} allowedFieldKeys
 */
function validateImportFieldMapping(fieldMapping, allowedFieldKeys) {
  const errors = [];
  let mappedCount = 0;

  if (!fieldMapping || typeof fieldMapping !== 'object') {
    return { valid: false, errors: ['fieldMapping is required'], mappedCount: 0 };
  }

  const usedTargets = new Set();
  for (const [csvHeader, targetField] of Object.entries(fieldMapping)) {
    const target = String(targetField || '').trim();
    if (!target) continue;
    mappedCount += 1;

    if (!allowedFieldKeys.has(target)) {
      errors.push(`Invalid target field "${target}" for column "${csvHeader}"`);
      continue;
    }
    if (usedTargets.has(target)) {
      errors.push(`Duplicate mapping to field "${target}"`);
    }
    usedTargets.add(target);
  }

  if (mappedCount === 0) {
    errors.push('At least one CSV column must be mapped to a module field');
  }

  return { valid: errors.length === 0, errors, mappedCount };
}

module.exports = {
  normalizeImportFieldToken,
  applyImportMappingTemplate,
  buildColumnRulesFromFieldMapping,
  validateImportFieldMapping,
  headerMatchesRule,
  detectAliasCollisions,
  detectCrossRuleAliasCollisions,
  dedupeColumnRuleAliases,
};
