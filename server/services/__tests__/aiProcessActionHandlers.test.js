'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  aiClassifyAction,
  aiExtractAction,
  parseLabels,
} = require('../aiProcessActionHandlers');
const { AiConfigurationError } = require('../ai/errors');

describe('aiProcessActionHandlers', () => {
  it('parseLabels splits commas and newlines', () => {
    assert.deepEqual(parseLabels('a, b\nc'), ['a', 'b', 'c']);
  });

  it('ai_classify stores propose-only result in dataBag', async () => {
    const calls = [];
    const ctx = {
      organizationId: 'org1',
      entityId: 'rec1',
      entityType: 'cases',
      triggeredBy: 'user1',
      dataBag: {},
      event: { currentState: { description: 'Please fix my invoice' } },
    };
    const result = await aiClassifyAction(
      ctx,
      {
        text: '{{trigger.description}}',
        labels: 'billing\ntechnical\ngeneral',
        fallbackLabel: 'general',
        variableName: 'aiClassification',
      },
      {
        isAiSuiteEntitledForOrg: async () => true,
        classifyText: async (args) => {
          calls.push(args);
          return {
            label: 'billing',
            confidence: 0.88,
            rationale: 'invoice language',
            matched: true,
            allowedLabels: ['billing', 'technical', 'general'],
            provider: 'openai',
            model: 'gpt-test',
            keyMode: 'platform',
          };
        },
      }
    );
    assert.equal(result.ok, true);
    assert.equal(result.confirmRequired, true);
    assert.equal(ctx.dataBag.aiClassification.label, 'billing');
    assert.equal(ctx.dataBag.aiClassification.confirmRequired, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, 'Please fix my invoice');
    assert.deepEqual(calls[0].labels, ['billing', 'technical', 'general']);
  });

  it('ai_classify fails closed when AI suite not entitled', async () => {
    const result = await aiClassifyAction(
      { organizationId: 'org1', dataBag: {} },
      { text: 'hello', labels: 'a\nb', variableName: 'x' },
      {
        isAiSuiteEntitledForOrg: async () => false,
        classifyText: async () => {
          throw new Error('should not call');
        },
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'AI_SUITE_NOT_ENTITLED');
  });

  it('ai_extract stores patches without writing records', async () => {
    const ctx = {
      organizationId: 'org1',
      entityId: 'p1',
      entityType: 'people',
      dataBag: {},
      event: { currentState: { notes: 'Call me at 555-0100' } },
    };
    const result = await aiExtractAction(
      ctx,
      {
        text: '{{trigger.notes}}',
        moduleKey: 'people',
        variableName: 'aiPatches',
      },
      {
        isAiSuiteEntitledForOrg: async () => true,
        extractFields: async () => ({
          patches: [{ fieldKey: 'phone', value: '555', confidence: 0.9, rationale: 'clear' }],
          rawText: '{"patches":[]}',
          provider: 'openai',
          model: 'gpt-test',
          keyMode: 'platform',
        }),
      }
    );
    assert.equal(result.ok, true);
    assert.equal(result.confirmRequired, true);
    assert.equal(ctx.dataBag.aiPatches.length, 1);
    assert.equal(ctx.dataBag.aiPatches[0].fieldKey, 'phone');
    assert.equal(ctx.dataBag.aiPatches__meta.confirmRequired, true);
  });

  it('ai_classify rejects fewer than two labels', async () => {
    const result = await aiClassifyAction(
      { organizationId: 'org1', dataBag: {} },
      { text: 'x', labels: 'only-one', variableName: 'x' },
      { isAiSuiteEntitledForOrg: async () => true }
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /two labels/i);
  });

  it('ai_classify surfaces provider errors without throwing', async () => {
    const result = await aiClassifyAction(
      { organizationId: 'org1', dataBag: {} },
      { text: 'x', labels: 'a\nb', variableName: 'x' },
      {
        isAiSuiteEntitledForOrg: async () => true,
        classifyText: async () => {
          throw new AiConfigurationError('AI disabled', 'AI_DISABLED');
        },
      }
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'AI_DISABLED');
  });
});
