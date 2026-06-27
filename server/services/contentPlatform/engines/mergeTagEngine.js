'use strict';

const {
  formatCurrencyAmount,
  resolveCurrencyDisplayMode
} = require('../../../utils/currencyFormat');

const MERGE_TAG_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const CURRENCY_LEAF_FIELDS = new Set([
  'unitprice',
  'linetotal',
  'linesubtotal',
  'subtotal',
  'taxtotal',
  'grandtotal',
  'sectiontotal',
  'sectionsubtotal',
  'sectiondiscounttotal',
  'amountdue',
  'unitpricesnapshot',
  'linediscounttotal',
  'globaldiscounttotal',
  'adjustmenttotal',
  'discountamount',
  'discounttotal'
]);

/**
 * @param {Record<string, unknown>} scope
 */
function resolveCurrencyCode(scope) {
  return String(
    scope?.parameters?.currency
    || scope?.Quote?.currency
    || scope?.Invoice?.currency
    || scope?.Record?.currency
    || scope?.record?.currency
    || scope?.line?.currencySnapshot
    || scope?.currencySnapshot
    || ''
  ).trim();
}

/**
 * @param {string} pathPart
 */
function inferCurrencyFormat(pathPart) {
  const leaf = String(pathPart || '').split('.').pop()?.toLowerCase() || '';
  return CURRENCY_LEAF_FIELDS.has(leaf) ? 'currency' : '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value, formatSpec, context) {
  if (value == null || value === '') return '';

  const format = String(formatSpec || '').trim().toLowerCase();
  const currency = resolveCurrencyCode(context);

  switch (format) {
    case 'currency':
      return formatCurrency(value, currency, context);
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

function formatCurrency(value, currency, context) {
  const locale = String(context?.parameters?.locale || context?.locale || 'en-US');
  return formatCurrencyAmount(
    value,
    currency,
    resolveCurrencyDisplayMode(context),
    locale
  );
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
  const field = path.slice('lines.'.length);
  if (scope?.line && Object.prototype.hasOwnProperty.call(scope.line, field)) {
    return `line.${field}`;
  }
  if (scope?.item && Object.prototype.hasOwnProperty.call(scope.item, field)) {
    return `line.${field}`;
  }
  return field;
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
  const explicitFormat = formatParts.join('|').replace(/^format:/i, '');
  const formatSpec = explicitFormat || inferCurrencyFormat(pathPart);
  const normalizedPath = normalizeLineItemPath(rootScope, pathPart);

  const { found, value } = resolvePath(rootScope, normalizedPath);
  if (!found) {
    return { value: '', resolved: false, path: pathPart };
  }

  return {
    value: formatValue(value, formatSpec, rootScope),
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
  formatValue,
  resolveCurrencyCode,
  inferCurrencyFormat
};
