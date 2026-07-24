'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAgentPickJson,
  buildAgentCards,
  pickAgentWithLlm,
} = require('../pickAgentWithLlm');

describe('pickAgentWithLlm', () => {
  it('parses fenced agent JSON', () => {
    const parsed = parseAgentPickJson('```json\n{"agentKey":"deal-summary","confidence":0.91,"reason":"record focus"}\n```');
    assert.equal(parsed.agentKey, 'deal-summary');
    assert.equal(parsed.confidence, 0.91);
  });

  it('builds cards without clarifier', () => {
    const cards = buildAgentCards({
      listAgents: () => [
        { name: 'clarifier', title: 'Clarifier', description: 'x' },
        { name: 'deal-summary', title: 'Deal Summarizer', description: 'Summarize one deal' },
        { name: 'pipeline-summary', title: 'Pipeline Summary Agent', description: 'Pipeline overview' },
      ],
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[0].key, 'deal-summary');
  });

  it('uses LLM pick when valid', async () => {
    const agents = {
      hasAgent: (k) => ['deal-summary', 'pipeline-summary', 'coworker'].includes(k),
      getAgent: (k) => ({ name: k, title: k }),
      listAgents: () => [
        { name: 'coworker', title: 'Coworker', description: 'General' },
        { name: 'deal-summary', title: 'Deal Summarizer', description: 'Summarize one focused deal' },
        { name: 'pipeline-summary', title: 'Pipeline Summary Agent', description: 'Summarize the whole pipeline' },
      ],
    };
    const result = await pickAgentWithLlm({
      query: 'Summarize this deal',
      request: {},
      classification: { intent: 'crm_search', agentKey: 'coworker' },
      agents,
      focus: { moduleKey: 'deals', id: 'abc', name: 'Sample Deal' },
      llm: async () => ({
        text: '{"agentKey":"deal-summary","confidence":0.94,"reason":"focused deal summary"}',
      }),
    });
    assert.equal(result.agentKey, 'deal-summary');
    assert.equal(result.source, 'llm');
  });

  it('falls back when LLM returns unknown key', async () => {
    const agents = {
      hasAgent: (k) => k === 'coworker' || k === 'pipeline-summary',
      getAgent: (k) => ({ name: k }),
      listAgents: () => [
        { name: 'coworker', title: 'Coworker', description: 'General assistant' },
        { name: 'pipeline-summary', title: 'Pipeline Summary Agent', description: 'pipeline deals summarize' },
      ],
    };
    const result = await pickAgentWithLlm({
      query: 'Summarize this deal',
      request: {},
      classification: { intent: 'crm_search', agentKey: 'coworker' },
      agents,
      focus: { moduleKey: 'deals', id: 'abc', name: 'Sample Deal' },
      llm: async () => ({ text: '{"agentKey":"not-real","confidence":0.99}' }),
    });
    assert.equal(result.source, 'heuristic');
    assert.ok(result.agentKey);
  });

  it('honors explicit request.agent', async () => {
    const agents = {
      hasAgent: () => true,
      listAgents: () => [{ name: 'coworker', title: 'Coworker', description: 'x' }],
    };
    const result = await pickAgentWithLlm({
      query: 'Summarize this deal',
      request: { agent: 'deal-summary' },
      classification: {},
      agents,
      llm: async () => ({ text: '{"agentKey":"coworker","confidence":0.99}' }),
    });
    assert.equal(result.agentKey, 'deal-summary');
    assert.equal(result.source, 'explicit');
  });
});
