const { MAILROOM_POLICY_TYPES } = require('../../../constants/mailroomPolicies');
const { evaluateThreadingSignal } = require('./strategies/threadingStrategies');
const { evaluateDedup } = require('./strategies/dedupStrategies');
const { evaluateCaseLink } = require('./strategies/caseLinkStrategies');

/**
 * Evaluate a tenant Mailroom policy.
 *
 * @param {'ingest'|'threading'|'dedup'|'case_link'|'classification'|'dispatch'} policyType
 * @param {{ message: object, candidates?: object, policies: object }} context
 * @returns {object}
 */
function evaluate(policyType, context = {}) {
  const type = String(policyType || '').toLowerCase();
  if (!MAILROOM_POLICY_TYPES.includes(type)) {
    throw new Error(`Unknown mailroom policy type: ${policyType}`);
  }

  const message = context.message || context.normalizedMessage || {};
  const candidates = context.candidates || {};
  const policies = context.policies || {};

  if (type === 'threading') {
    return evaluateThreading(policies.threading, message, candidates);
  }
  if (type === 'ingest') {
    return evaluateIngest(policies.ingest, message);
  }
  if (type === 'dedup') {
    return evaluateDedupPolicy(policies.dedup, message, candidates);
  }
  if (type === 'case_link') {
    return evaluateCaseLinkPolicy(policies.caseLink, message, candidates);
  }
  if (type === 'classification') {
    return evaluateClassification(policies.classification, message);
  }
  if (type === 'dispatch') {
    return evaluateDispatch(policies.dispatch, context);
  }

  throw new Error(`Unhandled policy type: ${type}`);
}

function evaluateThreading(threadingPolicy, message, candidates) {
  const policy = threadingPolicy || {};
  const strategies = (Array.isArray(policy.strategies) ? policy.strategies : [])
    .filter((s) => s.enabled !== false);

  const trace = [];
  for (const strategy of strategies) {
    const match = evaluateThreadingSignal(
      strategy.signal,
      message,
      candidates,
      strategy.params || {}
    );
    trace.push({
      strategyId: strategy.id || strategy.signal,
      signal: strategy.signal,
      matched: Boolean(match)
    });
    if (match) {
      return {
        policyType: 'threading',
        matched: true,
        strategyId: strategy.id || strategy.signal,
        signal: strategy.signal,
        target: match,
        trace
      };
    }
  }

  return {
    policyType: 'threading',
    matched: false,
    strategyId: null,
    signal: null,
    target: null,
    fallback: policy.fallback || { action: 'no_match' },
    trace
  };
}

function evaluateDedupPolicy(dedupPolicy, message, candidates) {
  const result = evaluateDedup(message, candidates, dedupPolicy);
  return {
    policyType: 'dedup',
    ...result
  };
}

function evaluateCaseLinkPolicy(caseLinkPolicy, message, candidates, threadingEvaluation) {
  let threadingTarget = threadingEvaluation?.matched ? threadingEvaluation.target : null;
  if (threadingTarget?.conversationId && !threadingTarget?.caseId) {
    const conv = (candidates.conversations || []).find(
      (c) => String(c._id || c.id) === String(threadingTarget.conversationId)
    );
    if (conv?.primaryCaseId) {
      threadingTarget = { ...threadingTarget, caseId: conv.primaryCaseId };
    }
  }

  const result = evaluateCaseLink(message, candidates, caseLinkPolicy, {
    threadingTarget
  });
  return {
    policyType: 'case_link',
    ...result
  };
}

function evaluateClassification(classificationPolicy, message) {
  const rules = Array.isArray(classificationPolicy?.rules) ? classificationPolicy.rules : [];
  const suggestions = {
    caseType: null,
    priority: null,
    queue: classificationPolicy?.defaultQueue || null,
    spam: false
  };

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const field = String(rule.field || '');
    const op = String(rule.operator || 'contains');
    const value = rule.value;
    let hay = '';
    if (field === 'subject') hay = String(message.subject || '');
    else if (field === 'from') {
      const from = message.participants?.from;
      hay = typeof from === 'string' ? from : from?.address || '';
    }
    if (op === 'contains' && value && hay.toLowerCase().includes(String(value).toLowerCase())) {
      if (rule.suggestCaseType) suggestions.caseType = rule.suggestCaseType;
      if (rule.suggestPriority) suggestions.priority = rule.suggestPriority;
      if (rule.suggestQueue) suggestions.queue = rule.suggestQueue;
      if (rule.markSpam) suggestions.spam = true;
    }
  }

  return {
    policyType: 'classification',
    suggestions,
    trace: [`evaluated ${rules.length} classification rules`]
  };
}

function evaluateDispatch(dispatchPolicy, context) {
  const publish = Array.isArray(dispatchPolicy?.publish) ? dispatchPolicy.publish : [];
  return {
    policyType: 'dispatch',
    eventsToPublish: publish,
    trace: [`${publish.length} events configured for publish`]
  };
}

function toLower(value) {
  return String(value || '').trim().toLowerCase();
}

function listParticipantValues(participants, field, message) {
  if (field === 'subject') return [toLower(participants?.subject)];
  const pick = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return toLower(entry);
    return toLower(entry.address || entry.email || '');
  };
  if (field === 'from') {
    const from = participants?.from;
    return [pick(from)];
  }
  if (field === 'from_domain') {
    const from = participants?.from;
    const raw = pick(from);
    const domain = raw.includes('@') ? raw.split('@').pop() : '';
    return [domain];
  }
  if (field === 'mailbox_kind') {
    return [toLower(participants?.metadata?.mailboxKind)];
  }
  if (field === 'channel') {
    const fromMessage = toLower(message?.channel);
    const fromMeta = toLower(participants?.metadata?.channel);
    return [fromMessage, fromMeta].filter(Boolean);
  }
  const arr = Array.isArray(participants?.[field]) ? participants[field] : [];
  return arr.map(pick).filter(Boolean);
}

function matchCondition(values, cond) {
  const operator = String(cond.operator || 'contains');
  const inputValue = cond.value;
  if (!values.length) return false;
  if (operator === 'in') {
    const expected = Array.isArray(inputValue) ? inputValue.map(toLower) : [toLower(inputValue)];
    return values.some((v) => expected.includes(v));
  }
  const needle = toLower(inputValue);
  if (!needle) return false;
  if (operator === 'equals') return values.some((v) => v === needle);
  if (operator === 'ends_with') return values.some((v) => v.endsWith(needle));
  return values.some((v) => v.includes(needle));
}

function evaluateIngest(ingestPolicy, message) {
  const policy = ingestPolicy || {};
  const rules = Array.isArray(policy.rules) ? policy.rules : [];
  const trace = [];

  const participants = {
    ...(message?.participants || {}),
    subject: message?.subject || '',
    metadata: message?.metadata || {}
  };

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (rule?.enabled === false) continue;
    const mode = String(rule.match || 'all').toLowerCase() === 'any' ? 'any' : 'all';
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    const checks = conditions.map((cond) => {
      const values = listParticipantValues(participants, cond.field, message);
      return {
        field: cond.field,
        operator: cond.operator,
        matched: matchCondition(values, cond)
      };
    });
    const matched = checks.length > 0 && (mode === 'any'
      ? checks.some((c) => c.matched)
      : checks.every((c) => c.matched));
    trace.push({ index: i, ruleId: rule.id || null, matched, checks });
    if (matched) {
      return {
        policyType: 'ingest',
        matched: true,
        ruleId: rule.id || null,
        action: rule.action || { type: 'route_to_case_flow' },
        trace
      };
    }
  }

  return {
    policyType: 'ingest',
    matched: false,
    ruleId: null,
    action: policy.defaultAction || { type: 'route_to_case_flow' },
    trace
  };
}

/**
 * Run threading → dedup → case_link in sequence (no side effects).
 */
function evaluatePipeline(context = {}) {
  const ingest = evaluate('ingest', context);
  const threading = evaluate('threading', context);
  const dedup = evaluate('dedup', context);
  const caseLink = evaluateCaseLinkPolicy(
    context.policies?.caseLink,
    context.message || context.normalizedMessage || {},
    context.candidates || {},
    threading
  );
  const classification = evaluate('classification', context);
  const dispatch = evaluate('dispatch', context);

  return {
    ingest,
    threading,
    dedup,
    caseLink,
    classification,
    dispatch
  };
}

module.exports = {
  evaluate,
  evaluatePipeline
};
