'use strict';

/**
 * Mailroom AI classify assist — untrusted-tier, propose-only.
 * Never changes ingest action, never auto-applies case type/priority/queue.
 * Attaches suggestions onto classification evaluation for human/agent review.
 */

const { isAiSuiteEntitledForOrg } = require('../../../utils/addonAccessUtils');

// Legacy AI classify service removed with Astra v2 cutover. Default soft-fails;
// callers may inject a test double via deps.classifyText.
function classifyText() {
  const err = new Error('AI classify capability has been removed');
  err.code = 'AI_CAPABILITY_REMOVED';
  throw err;
}

const DEFAULT_ROUTE_LABELS = [
  'billing',
  'technical',
  'account',
  'sales',
  'spam',
  'general',
];

function buildClassifyText(normalizedMessage = {}) {
  const subject = String(normalizedMessage.subject || '').trim();
  const body = String(normalizedMessage.body || normalizedMessage.textBody || '').trim();
  const from =
    typeof normalizedMessage.participants?.from === 'string'
      ? normalizedMessage.participants.from
      : normalizedMessage.participants?.from?.address
        || normalizedMessage.participants?.from?.email
        || '';
  const parts = [
    from ? `From: ${from}` : '',
    subject ? `Subject: ${subject}` : '',
    body ? `Body:\n${body.slice(0, 4000)}` : '',
  ].filter(Boolean);
  return parts.join('\n\n').trim();
}

function resolveRouteLabels(classificationPolicy = {}) {
  const custom = Array.isArray(classificationPolicy.aiLabels)
    ? classificationPolicy.aiLabels.map((l) => String(l).trim()).filter(Boolean)
    : [];
  if (custom.length >= 2) return custom.slice(0, 20);
  return DEFAULT_ROUTE_LABELS;
}

/**
 * @returns {Promise<object|null>} aiAssist payload or null when skipped/failed soft
 */
async function suggestMailroomAiClassification({
  organizationId,
  normalizedMessage,
  classificationPolicy = {},
  userId = null,
  deps = {},
}) {
  if (classificationPolicy.aiAssist !== true) {
    return null;
  }

  const isEntitled = deps.isAiSuiteEntitledForOrg || isAiSuiteEntitledForOrg;
  const classifyFn = deps.classifyText || classifyText;

  try {
    const entitled = await isEntitled(organizationId);
    if (!entitled) {
      return {
        skipped: true,
        reason: 'AI_SUITE_NOT_ENTITLED',
        confirmRequired: true,
      };
    }

    const text = buildClassifyText(normalizedMessage);
    if (!text) {
      return {
        skipped: true,
        reason: 'AI_TEXT_EMPTY',
        confirmRequired: true,
      };
    }

    const labels = resolveRouteLabels(classificationPolicy);
    const fallbackLabel =
      classificationPolicy.aiFallbackLabel && labels.includes(classificationPolicy.aiFallbackLabel)
        ? classificationPolicy.aiFallbackLabel
        : labels.includes('general')
          ? 'general'
          : labels[0];

    const result = await classifyFn({
      organizationId,
      userId,
      labels,
      fallbackLabel,
      text,
      sourceType: 'mailroom',
      sourceId: normalizedMessage.messageId || normalizedMessage.id || null,
    });

    return {
      skipped: false,
      confirmRequired: true,
      applyMode: 'suggest_only',
      label: result.label,
      confidence: result.confidence,
      rationale: result.rationale,
      matched: result.matched,
      allowedLabels: result.allowedLabels || labels,
      provider: result.provider,
      model: result.model,
      keyMode: result.keyMode,
      // Explicit route proposal — never auto-executed by mailroom
      proposedRoute: {
        intentLabel: result.label,
        createOrLink: result.label === 'spam' ? 'manual_review' : 'propose_case_link',
      },
    };
  } catch (err) {
    // Soft-fail: mailroom must never block on AI
    return {
      skipped: true,
      reason: err.code || 'AI_CLASSIFY_FAILED',
      error: err.message || String(err),
      confirmRequired: true,
    };
  }
}

/**
 * Attach AI assist onto an existing classification evaluation (mutate-safe copy).
 */
function attachAiAssistToClassification(classificationEval, aiAssist) {
  if (!aiAssist) return classificationEval || null;
  const base = classificationEval && typeof classificationEval === 'object'
    ? { ...classificationEval }
    : { policyType: 'classification', suggestions: {}, matched: false };
  return {
    ...base,
    aiAssist,
  };
}

module.exports = {
  DEFAULT_ROUTE_LABELS,
  buildClassifyText,
  resolveRouteLabels,
  suggestMailroomAiClassification,
  attachAiAssistToClassification,
};
