'use strict';

const CLASSIFICATION_FIELDS = ['subject', 'from', 'from_domain', 'body', 'channel'];
const CLASSIFICATION_OPERATORS = ['contains', 'equals', 'ends_with', 'in'];
const CLASSIFICATION_APPLY_MODES = ['suggest_only', 'auto_apply'];
const CLASSIFICATION_ON_SPAM = ['ignore', 'manual_review', 'route_to_case_flow'];

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function getFieldHaystack(message, field) {
  const participants = message?.participants || {};
  if (field === 'subject') return toLower(message?.subject);
  if (field === 'body') return toLower(message?.body || message?.htmlBody || '');
  if (field === 'channel') return toLower(message?.channel);
  if (field === 'from') {
    const from = participants.from;
    if (typeof from === 'string') return toLower(from);
    return toLower(from?.address || from?.email || '');
  }
  if (field === 'from_domain') {
    const from = participants.from;
    const raw = typeof from === 'string' ? from : from?.address || from?.email || '';
    const addr = toLower(raw);
    return addr.includes('@') ? addr.split('@').pop() : '';
  }
  return '';
}

function matchOperator(haystack, operator, value) {
  const hay = toLower(haystack);
  const op = String(operator || 'contains');
  if (op === 'in') {
    const expected = Array.isArray(value)
      ? value.map(toLower)
      : String(value || '').split(',').map((v) => toLower(v)).filter(Boolean);
    return expected.some((needle) => hay === needle || hay.includes(needle));
  }
  const needle = toLower(value);
  if (!needle) return false;
  if (op === 'equals') return hay === needle;
  if (op === 'ends_with') return hay.endsWith(needle);
  return hay.includes(needle);
}

function evaluateClassification(classificationPolicy, message) {
  const policy = classificationPolicy || {};
  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  const suggestions = {
    caseType: null,
    priority: null,
    queue: policy.defaultQueue || null,
    spam: false
  };
  const matchedRuleIds = [];
  const trace = [];

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (rule?.enabled === false) continue;
    const field = String(rule.field || 'subject');
    const hay = getFieldHaystack(message, field);
    const matched = matchOperator(hay, rule.operator, rule.value);
    trace.push({
      index: i,
      ruleId: rule.id || null,
      field,
      operator: rule.operator || 'contains',
      matched
    });
    if (!matched) continue;

    matchedRuleIds.push(rule.id || `rule-${i + 1}`);
    if (rule.suggestCaseType) suggestions.caseType = rule.suggestCaseType;
    if (rule.suggestPriority) suggestions.priority = rule.suggestPriority;
    if (rule.suggestQueue) suggestions.queue = rule.suggestQueue;
    if (rule.markSpam) suggestions.spam = true;

    if (policy.stopOnFirstMatch !== false) break;
  }

  return {
    policyType: 'classification',
    matched: matchedRuleIds.length > 0,
    matchedRuleIds,
    suggestions,
    applyMode: policy.applyMode || 'auto_apply',
    onSpam: policy.onSpam || 'ignore',
    trace
  };
}

function normalizeDefaultsForCaseCreate(defaults = {}) {
  return {
    defaultCaseType: defaults.defaultCaseType || defaults.caseType || 'Support Ticket',
    defaultPriority: defaults.defaultPriority || defaults.priority || 'Medium',
    defaultChannel: defaults.defaultChannel || defaults.channel || 'Email',
    defaultQueue: defaults.defaultQueue || defaults.queue || null
  };
}

function mergeClassificationDefaults(baseDefaults, classificationEval, classificationPolicy = {}) {
  const base = normalizeDefaultsForCaseCreate(baseDefaults);
  const mode = classificationPolicy.applyMode || classificationEval?.applyMode || 'auto_apply';
  const suggestions = classificationEval?.suggestions || {};

  if (mode === 'suggest_only') {
    return {
      ...base,
      classificationSuggestions: suggestions,
      classificationMatchedRuleIds: classificationEval?.matchedRuleIds || []
    };
  }

  return {
    ...base,
    defaultCaseType: suggestions.caseType || base.defaultCaseType,
    defaultPriority: suggestions.priority || base.defaultPriority,
    defaultQueue: suggestions.queue != null && suggestions.queue !== ''
      ? suggestions.queue
      : base.defaultQueue,
    classificationSuggestions: suggestions,
    classificationMatchedRuleIds: classificationEval?.matchedRuleIds || []
  };
}

function resolveIngestActionForSpam(classificationEval, classificationPolicy = {}) {
  if (!classificationEval?.suggestions?.spam) return null;
  const onSpam = classificationPolicy.onSpam || classificationEval.onSpam || 'ignore';
  if (onSpam === 'route_to_case_flow') return null;
  return onSpam;
}

module.exports = {
  CLASSIFICATION_FIELDS,
  CLASSIFICATION_OPERATORS,
  CLASSIFICATION_APPLY_MODES,
  CLASSIFICATION_ON_SPAM,
  evaluateClassification,
  mergeClassificationDefaults,
  normalizeDefaultsForCaseCreate,
  resolveIngestActionForSpam
};
