'use strict';

const MERGE_TAG_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value, formatSpec, context) {
  if (value == null || value === '') return '';

  const format = String(formatSpec || '').trim().toLowerCase();
  const currency = context?.parameters?.currency || context?.record?.currency || '';

  switch (format) {
    case 'currency':
      return formatCurrency(value, currency);
    case 'date':
      return formatDate(value);
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    default:
      return String(value);
  }
}

function formatCurrency(value, currency) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '');
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return currency ? `${formatted} ${currency}`.trim() : formatted;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} path
 */
function resolvePath(scope, path) {
  const parts = String(path || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  let current = scope;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }

  return { found: true, value: current };
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} pathPart
 */
function normalizeLineItemPath(scope, pathPart) {
  const path = String(pathPart || '').trim();
  if (!path.toLowerCase().startsWith('lines.')) return path;
  if (!scope?.line && !scope?.item) return path;
  return path.slice('lines.'.length);
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} expression
 */
function resolveMergeExpression(rootScope, expression) {
  const raw = String(expression || '').trim();
  if (!raw) {
    return { value: '', resolved: false, path: raw };
  }

  const [pathPart, ...formatParts] = raw.split('|').map((part) => part.trim());
  const formatSpec = formatParts.join('|');
  const normalizedPath = normalizeLineItemPath(rootScope, pathPart);

  const { found, value } = resolvePath(rootScope, normalizedPath);
  if (!found) {
    return { value: '', resolved: false, path: pathPart };
  }

  return {
    value: formatValue(value, formatSpec.replace(/^format:/i, ''), rootScope),
    resolved: true,
    path: pathPart
  };
}

/**
 * @param {string} input
 * @param {Record<string, unknown>} scope
 * @param {{ collectIssues?: Array<object> }} [options]
 */
function resolveMergeTagsInString(input, scope, options = {}) {
  if (input == null) return '';
  const text = String(input);
  const issues = options.collectIssues;

  return text.replace(MERGE_TAG_PATTERN, (match, expression) => {
    const result = resolveMergeExpression(scope, expression);
    if (!result.resolved) {
      const issue = {
        severity: options.lenient ? 'warning' : 'error',
        code: 'MERGE_TAG_UNRESOLVED',
        message: `Merge tag could not be resolved: ${match}`,
        path: result.path
      };
      issues?.push(issue);
      return options.lenient ? match : '';
    }
    return result.value ?? '';
  });
}

module.exports = {
  MERGE_TAG_PATTERN,
  resolvePath,
  normalizeLineItemPath,
  resolveMergeExpression,
  resolveMergeTagsInString,
  formatValue
};
