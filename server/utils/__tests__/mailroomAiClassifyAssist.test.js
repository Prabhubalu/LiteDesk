'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildClassifyText,
  resolveRouteLabels,
  suggestMailroomAiClassification,
  attachAiAssistToClassification,
  DEFAULT_ROUTE_LABELS,
} = require('../../platform/mailroom/services/mailroomAiClassifyAssist');
const { sanitizeMailroomConfig } = require('../../platform/mailroom/policies/validators/mailroomPolicyValidator');

describe('mailroomAiClassifyAssist', () => {
  it('buildClassifyText includes subject and body', () => {
    const text = buildClassifyText({
      subject: 'Invoice overdue',
      body: 'Please send receipt',
      participants: { from: { address: 'a@b.com' } },
    });
    assert.match(text, /Invoice overdue/);
    assert.match(text, /Please send receipt/);
    assert.match(text, /a@b.com/);
  });

  it('resolveRouteLabels uses custom labels when enough provided', () => {
    assert.deepEqual(resolveRouteLabels({ aiLabels: ['a', 'b'] }), ['a', 'b']);
    assert.deepEqual(resolveRouteLabels({}), DEFAULT_ROUTE_LABELS);
  });

  it('skips when aiAssist is not enabled', async () => {
    const result = await suggestMailroomAiClassification({
      organizationId: 'org1',
      normalizedMessage: { subject: 'hi', body: 'there' },
      classificationPolicy: { aiAssist: false },
      deps: {
        classifyText: async () => {
          throw new Error('should not call');
        },
      },
    });
    assert.equal(result, null);
  });

  it('returns propose-only assist and never auto-applies', async () => {
    const result = await suggestMailroomAiClassification({
      organizationId: 'org1',
      normalizedMessage: { subject: 'billing help', body: 'invoice issue' },
      classificationPolicy: { aiAssist: true },
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        classifyText: async () => ({
          label: 'billing',
          confidence: 0.91,
          rationale: 'invoice',
          matched: true,
          allowedLabels: DEFAULT_ROUTE_LABELS,
          provider: 'openai',
          model: 'mini',
          keyMode: 'platform',
        }),
      },
    });
    assert.equal(result.skipped, false);
    assert.equal(result.confirmRequired, true);
    assert.equal(result.applyMode, 'suggest_only');
    assert.equal(result.label, 'billing');
    assert.equal(result.proposedRoute.createOrLink, 'propose_case_link');
  });

  it('soft-fails when AI throws (mailroom never blocks)', async () => {
    const result = await suggestMailroomAiClassification({
      organizationId: 'org1',
      normalizedMessage: { subject: 'x', body: 'y' },
      classificationPolicy: { aiAssist: true },
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        classifyText: async () => {
          const err = new Error('provider down');
          err.code = 'AI_PROVIDER_ERROR';
          throw err;
        },
      },
    });
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'AI_PROVIDER_ERROR');
    assert.equal(result.confirmRequired, true);
  });

  it('attachAiAssistToClassification preserves rule suggestions', () => {
    const merged = attachAiAssistToClassification(
      { suggestions: { priority: 'High' }, matched: true },
      { label: 'billing', confirmRequired: true }
    );
    assert.equal(merged.suggestions.priority, 'High');
    assert.equal(merged.aiAssist.label, 'billing');
  });

  it('sanitizeClassificationPolicy preserves aiAssist flag', () => {
    const sanitized = sanitizeMailroomConfig({
      enabled: true,
      policies: {
        classification: {
          aiAssist: true,
          aiLabels: ['billing', 'technical'],
          aiFallbackLabel: 'technical',
          rules: [],
        },
      },
    });
    assert.equal(sanitized.policies.classification.aiAssist, true);
    assert.deepEqual(sanitized.policies.classification.aiLabels, ['billing', 'technical']);
    assert.equal(sanitized.policies.classification.aiFallbackLabel, 'technical');
  });
});
