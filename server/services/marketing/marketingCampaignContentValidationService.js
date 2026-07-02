'use strict';

const { detectMergeTags } = require('../contentPlatform/mergeTagDetector');
const { getSchemaMergeTagFields } = require('../../utils/mergeTagModuleFields');

const MARKETING_MERGE_MODULES = Object.freeze([
  { moduleKey: 'people', alias: 'People' },
  { moduleKey: 'organizations', alias: 'Organization' }
]);

const MARKETING_SYSTEM_MERGE_PATHS = new Set([
  'unsubscribe_url',
  'unsubscribeurl',
  'preferences_url',
  'preferencesurl',
  'view_in_browser_url',
  'viewinbrowserurl'
]);

const HANDLEBARS_VALUE_TAG = /\{\{\s*(?!#|\/|\^|\>|\s*else\b)([^}]+?)\s*\}\}/gi;
const HUBSPOT_CONDITIONAL = /\{%\s*if\s+([^%]+?)%\}/gi;
const EMPTY_LINK = /<a\b[^>]*\bhref\s*=\s*["']?\s*(?:#|javascript:void\s*\(\s*\))\s*["']?[^>]*>/gi;
const MERGE_PATH = /^[A-Za-z_][\w.]*$/;

/**
 * @returns {Set<string>}
 */
function buildAllowedMergePaths() {
  /** @type {Set<string>} */
  const allowed = new Set(MARKETING_SYSTEM_MERGE_PATHS);

  for (const { moduleKey, alias } of MARKETING_MERGE_MODULES) {
    for (const field of getSchemaMergeTagFields(moduleKey)) {
      allowed.add(`${alias}.${field.key}`.toLowerCase());
      allowed.add(field.key.toLowerCase());
    }
    allowed.add(alias.toLowerCase());
  }

  return allowed;
}

const ALLOWED_MERGE_PATHS = buildAllowedMergePaths();

/**
 * @param {string} expression
 */
function normalizeMergeExpression(expression) {
  const raw = String(expression || '').trim();
  if (!raw) return '';
  const pathPart = raw.split('|')[0].trim();
  return pathPart.replace(/\s+/g, '');
}

/**
 * @param {string} pathPart
 */
function isAllowedMergePath(pathPart) {
  const normalized = String(pathPart || '').trim().toLowerCase();
  if (!normalized) return true;
  if (MARKETING_SYSTEM_MERGE_PATHS.has(normalized)) return true;
  if (ALLOWED_MERGE_PATHS.has(normalized)) return true;

  const root = normalized.split('.')[0];
  if (ALLOWED_MERGE_PATHS.has(root)) return true;

  for (const { alias } of MARKETING_MERGE_MODULES) {
    if (normalized.startsWith(`${alias.toLowerCase()}.`)) {
      const leaf = normalized.slice(alias.length + 1);
      return ALLOWED_MERGE_PATHS.has(`${alias.toLowerCase()}.${leaf}`);
    }
  }

  return false;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
function extractMergeExpressions(source) {
  const text = String(source || '');
  /** @type {Set<string>} */
  const expressions = new Set();
  const regex = new RegExp(HANDLEBARS_VALUE_TAG.source, HANDLEBARS_VALUE_TAG.flags);
  let match;
  while ((match = regex.exec(text)) !== null) {
    const normalized = normalizeMergeExpression(match[1]);
    if (normalized && MERGE_PATH.test(normalized.split('.')[0])) {
      expressions.add(normalized);
    }
  }
  return [...expressions];
}

/**
 * @param {string} html
 * @returns {{ count: number, blocks: { expression: string, raw: string }[] }}
 */
function detectConditionalBlocks(html) {
  const source = String(html || '');
  /** @type {{ expression: string, raw: string }[]} */
  const blocks = [];
  const regex = new RegExp(HUBSPOT_CONDITIONAL.source, HUBSPOT_CONDITIONAL.flags);
  let match;
  while ((match = regex.exec(source)) !== null) {
    blocks.push({ expression: match[1].trim(), raw: match[0] });
  }
  return { count: blocks.length, blocks };
}

/**
 * @param {string} html
 * @returns {number}
 */
function countEmptyLinks(html) {
  const source = String(html || '');
  const regex = new RegExp(EMPTY_LINK.source, EMPTY_LINK.flags);
  let count = 0;
  while (regex.exec(source) !== null) count += 1;
  return count;
}

/**
 * @param {{ subject?: string, bodyHtml?: string, fromEmail?: string }} campaign
 */
function validateCampaignContent(campaign = {}) {
  const subject = String(campaign.subject || '');
  const bodyHtml = String(campaign.bodyHtml || '');
  const fromEmail = String(campaign.fromEmail || '').trim();
  const combined = `${subject}\n${bodyHtml}`;

  /** @type {{ key: string, status: string, message: string, details?: unknown }[]} */
  const checks = [];

  checks.push({
    key: 'fromEmail',
    status: fromEmail && fromEmail.includes('@') ? 'ok' : 'error',
    message: fromEmail && fromEmail.includes('@') ? 'From address is set' : 'From email is required'
  });

  checks.push({
    key: 'subject',
    status: subject.trim() ? 'ok' : 'error',
    message: subject.trim() ? 'Subject line is set' : 'Subject line is required'
  });

  checks.push({
    key: 'body',
    status: bodyHtml.trim() ? 'ok' : 'error',
    message: bodyHtml.trim() ? 'Email body is set' : 'Email body is required'
  });

  const expressions = [
    ...extractMergeExpressions(subject),
    ...extractMergeExpressions(bodyHtml)
  ];
  const unresolved = [...new Set(expressions.filter((expr) => !isAllowedMergePath(expr)))];

  checks.push({
    key: 'mergeTags',
    status: unresolved.length === 0 ? 'ok' : 'warning',
    message:
      unresolved.length === 0
        ? 'All merge tags match known fields'
        : `${unresolved.length} merge tag(s) could not be matched to known fields`,
    details: { unresolved, detected: detectMergeTags(combined).length }
  });

  const emptyLinks = countEmptyLinks(bodyHtml);
  checks.push({
    key: 'links',
    status: emptyLinks === 0 ? 'ok' : 'warning',
    message:
      emptyLinks === 0
        ? 'No empty or placeholder links detected'
        : `${emptyLinks} link(s) use empty or placeholder URLs`,
    details: { emptyLinks }
  });

  const conditionals = detectConditionalBlocks(bodyHtml);
  checks.push({
    key: 'conditionals',
    status: conditionals.count === 0 ? 'ok' : 'info',
    message:
      conditionals.count === 0
        ? 'No conditional content blocks detected'
        : `${conditionals.count} conditional block(s) detected — verify rules before send`,
    details: conditionals
  });

  const blocking = checks.filter((check) => check.status === 'error');
  const ready = blocking.length === 0;

  return {
    ready,
    checks,
    unresolvedMergeTags: unresolved,
    conditionalBlockCount: conditionals.count
  };
}

module.exports = {
  validateCampaignContent,
  extractMergeExpressions,
  detectConditionalBlocks,
  isAllowedMergePath,
  buildAllowedMergePaths
};
