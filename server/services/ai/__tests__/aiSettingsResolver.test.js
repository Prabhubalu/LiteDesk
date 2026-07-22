'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AI_PROVIDERS } = require('../../../constants/aiProviders');
const {
  resolveModel,
  TENANT_MODEL_ABILITIES,
  CLASSIFY_TIER_ABILITIES,
} = require('../aiSettingsResolver');

describe('aiSettingsResolver.resolveModel', () => {
  const openaiSettings = {
    llmProvider: AI_PROVIDERS.OPENAI,
    llmModel: 'gpt-4o',
    modelOverrides: {},
  };

  it('uses org llmModel for user-facing abilities when set', () => {
    assert.equal(resolveModel(openaiSettings, 'work_graph_ask'), 'gpt-4o');
    assert.equal(resolveModel(openaiSettings, 'summarize'), 'gpt-4o');
    assert.equal(resolveModel(openaiSettings, 'ask'), 'gpt-4o');
  });

  it('defaults tenant_agent to classify/mini even when llmModel is set', () => {
    assert.equal(resolveModel(openaiSettings, 'tenant_agent'), 'gpt-4o-mini');
    assert.equal(
      resolveModel({ ...openaiSettings, modelOverrides: { tenant_agent: 'gpt-4o' } }, 'tenant_agent'),
      'gpt-4o',
    );
  });

  it('uses classify tier for background abilities even when llmModel is set', () => {
    assert.equal(resolveModel(openaiSettings, 'classify'), 'gpt-4o-mini');
    assert.equal(resolveModel(openaiSettings, 'import_mapping'), 'gpt-4o-mini');
  });

  it('falls back to classify mini when org has no saved llmModel', () => {
    const settings = { ...openaiSettings, llmModel: null };
    assert.equal(resolveModel(settings, 'tenant_agent'), 'gpt-4o-mini');
    assert.equal(resolveModel(settings, 'work_graph_ask'), 'gpt-4o-mini');
  });

  it('honours Anthropic BYOK org model for tenant abilities (not Astra ask)', () => {
    const settings = {
      llmProvider: AI_PROVIDERS.ANTHROPIC,
      llmModel: 'claude-fable-5',
      modelOverrides: {},
    };
    assert.equal(resolveModel(settings, 'work_graph_ask'), 'claude-fable-5');
    assert.equal(resolveModel(settings, 'tenant_agent'), 'claude-haiku-4-5-20251001');
    assert.equal(resolveModel(settings, 'classify'), 'claude-haiku-4-5-20251001');
  });

  it('keeps generate-tier abilities on llmModel / generate default', () => {
    assert.equal(resolveModel(openaiSettings, 'commercial_agent'), 'gpt-4o');
    assert.equal(resolveModel(openaiSettings, 'deal_quote_draft'), 'gpt-4o');
  });

  it('per-ability modelOverrides win over tenant model routing', () => {
    const settings = {
      ...openaiSettings,
      modelOverrides: { work_graph_ask: 'gpt-4.1' },
    };
    assert.equal(resolveModel(settings, 'work_graph_ask'), 'gpt-4.1');
  });

  it('exposes ability tier sets', () => {
    assert.ok(!TENANT_MODEL_ABILITIES.has('tenant_agent'));
    assert.ok(CLASSIFY_TIER_ABILITIES.has('classify'));
  });
});
