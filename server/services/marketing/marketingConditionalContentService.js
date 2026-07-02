'use strict';

const { resolveMergeExpression } = require('../contentPlatform/engines/mergeTagEngine');

const IF_BLOCK_REGEX = /\{%\s*if\b[^%]*%\}((?:(?!\{%\s*if\b)[\s\S])*?)(?:\{%\s*else\b[^%]*%\}((?:(?!\{%\s*if\b)[\s\S])*?))?\{%\s*endif\s*%\}/gi;
const UNLESS_BLOCK_REGEX = /\{%\s*unless\b[^%]*%\}([\s\S]*?)\{%\s*endunless\s*%\}/gi;

/**
 * @param {Record<string, unknown>} scope
 * @param {string} expression
 */
function isMergeExpressionTruthy(scope, expression) {
  const raw = String(expression || '').trim();
  if (!raw) return false;

  const normalized = raw.replace(/\s+/g, ' ');
  const result = resolveMergeExpression(scope, normalized);
  if (result.resolved) {
    const value = result.value;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return Boolean(String(value ?? '').trim());
  }

  return false;
}

/**
 * @param {string} html
 * @param {Record<string, unknown>} scope
 */
function evaluateHubspotConditionalsForRecipient(html, scope) {
  let output = String(html || '');
  if (!output.includes('{%')) return output;

  let previous = '';
  while (output !== previous) {
    previous = output;
    output = output.replace(IF_BLOCK_REGEX, (match, ifContent, elseContent) => {
      const conditionMatch = match.match(/\{%\s*if\s+([^%]+?)%\}/i);
      const expression = conditionMatch?.[1] || '';
      return isMergeExpressionTruthy(scope, expression) ? (ifContent || '') : (elseContent || '');
    });
    output = output.replace(UNLESS_BLOCK_REGEX, (match, inner) => {
      const conditionMatch = match.match(/\{%\s*unless\s+([^%]+?)%\}/i);
      const expression = conditionMatch?.[1] || '';
      return isMergeExpressionTruthy(scope, expression) ? '' : (inner || '');
    });
  }

  return output;
}

module.exports = {
  evaluateHubspotConditionalsForRecipient,
  isMergeExpressionTruthy
};
