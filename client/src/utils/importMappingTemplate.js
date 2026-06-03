/**
 * Client-side import mapping template utilities (mirrors server/utils/importMappingTemplateUtils.js).
 */

export function normalizeImportFieldToken(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s._-]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

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

export function detectAliasCollisions(columnRules, allowedKeys = null) {
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

function findMatchingRulesForHeader(header, columnRules, fields, allowedKeys) {
  const matches = [];
  for (const rule of columnRules || []) {
    const target = String(rule?.targetFieldKey || '').trim();
    if (!target || !allowedKeys.has(target)) continue;
    if (headerMatchesRule(header, rule, fields)) matches.push(rule);
  }
  return matches;
}

export function dedupeColumnRuleAliases(columnRules) {
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
export function applyImportMappingTemplate(csvHeaders, columnRules, fields) {
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
 * @param {Record<string, string>} fieldMapping
 * @param {Set<string>} [allowedFieldKeys]
 */
export function buildColumnRulesFromFieldMapping(fieldMapping, allowedFieldKeys = null) {
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
 * Default mapping: each CSV column maps to at most one module field (first column wins for a field).
 * @param {string[]} csvHeaders
 * @param {{ value: string, label?: string }[]} fields
 */
export function buildAutoImportFieldMapping(csvHeaders, fields) {
  const usedValues = new Set();
  const mapping = {};
  for (const header of csvHeaders) {
    const hNorm = normalizeImportFieldToken(header);
    let chosen = '';
    if (hNorm) {
      for (const field of fields) {
        if (usedValues.has(field.value)) continue;
        const keyNorm = normalizeImportFieldToken(field.value);
        const labelNorm = normalizeImportFieldToken(field.label);
        if (hNorm === keyNorm || hNorm === labelNorm) {
          chosen = field.value;
          usedValues.add(field.value);
          break;
        }
      }
    }
    mapping[header] = chosen;
  }
  return mapping;
}

export const ENTITY_TYPE_TO_IMPORT_MODULE = {
  Contacts: 'contacts',
  Deals: 'deals',
  Tasks: 'tasks',
  Organizations: 'organizations',
};

export function importModuleForEntityType(entityType) {
  return ENTITY_TYPE_TO_IMPORT_MODULE[entityType] || null;
}

/**
 * Canonical JSON snapshot of csvHeader → targetField for dirty-state comparison.
 * @param {string[]} csvHeaders
 * @param {Record<string, string>} mapping
 */
export function buildFieldMappingSnapshot(csvHeaders, mapping) {
  const headers = Array.isArray(csvHeaders) ? csvHeaders : [];
  const entries = [...headers]
    .map((h) => String(h || '').trim())
    .filter(Boolean)
    .sort()
    .map((header) => [header, String(mapping?.[header] || '').trim()]);
  return JSON.stringify(entries);
}

/**
 * @param {string[]} csvHeaders
 * @param {Record<string, string>} mapping
 * @param {string} snapshot
 */
export function fieldMappingMatchesSnapshot(csvHeaders, mapping, snapshot) {
  if (!snapshot) return false;
  return buildFieldMappingSnapshot(csvHeaders, mapping) === snapshot;
}
