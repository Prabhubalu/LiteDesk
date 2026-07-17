'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tryAiFaqAssist } = require('../liveChatBotRuntimeService');

describe('liveChatBotRuntimeService.tryAiFaqAssist', () => {
  it('skips when aiAssist is off', async () => {
    const out = await tryAiFaqAssist({
      organizationId: 'org1',
      session: {},
      bot: { aiAssist: false },
      visitorText: 'hello',
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        answerLiveChatFaq: async () => {
          throw new Error('should not call');
        },
      },
    });
    assert.equal(out, null);
  });

  it('skips when AI suite not entitled', async () => {
    const out = await tryAiFaqAssist({
      organizationId: 'org1',
      session: {},
      bot: { aiAssist: true },
      visitorText: 'hello',
      deps: {
        isAiSuiteEntitledForOrg: async () => false,
        answerLiveChatFaq: async () => {
          throw new Error('should not call');
        },
      },
    });
    assert.equal(out, null);
  });

  it('returns contained body when FAQ succeeds', async () => {
    const out = await tryAiFaqAssist({
      organizationId: 'org1',
      session: {},
      bot: { aiAssist: true },
      visitorText: 'reset password',
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        findBestBotAnswer: async () => ({ match: null, score: 0 }),
        answerLiveChatFaq: async () => ({
          contained: true,
          answer: 'Click Forgot password.',
          citations: [{ index: 1 }],
          provider: 'openai',
          model: 'gpt-test',
        }),
        formatBotReplyBody: (a) => a,
      },
    });
    assert.equal(out.contained, true);
    assert.equal(out.body, 'Click Forgot password.');
  });

  it('soft-fails to null when FAQ throws', async () => {
    const out = await tryAiFaqAssist({
      organizationId: 'org1',
      session: {},
      bot: { aiAssist: true },
      visitorText: 'hello',
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        findBestBotAnswer: async () => ({ match: null, score: 0 }),
        answerLiveChatFaq: async () => {
          throw new Error('provider down');
        },
      },
    });
    assert.equal(out, null);
  });

  it('falls back to excerpt LLM when vector FAQ misses', async () => {
    const out = await tryAiFaqAssist({
      organizationId: 'org1',
      session: {},
      bot: { aiAssist: true },
      visitorText: 'What are your support hours?',
      deps: {
        isAiSuiteEntitledForOrg: async () => true,
        findBestBotAnswer: async () => ({
          match: {
            title: 'Support Hours',
            body: 'Support hours are Mon–Fri 9am–5pm ET.',
            fullText: 'Support hours are Mon–Fri 9am–5pm ET. Refunds take 5–10 days.',
            sourceType: 'knowledge_base',
            sourceId: 'd1',
          },
          score: 12,
        }),
        answerLiveChatFaqFromExcerpts: async ({ excerpts }) => ({
          contained: true,
          answer: 'We are available Mon–Fri 9am–5pm ET.',
          citations: [{ index: 1, sourceId: excerpts[0].sourceId }],
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
        }),
        answerLiveChatFaq: async () => {
          throw new Error('should not call vector FAQ when excerpts contain');
        },
        formatBotReplyBody: (a) => a,
      },
    });
    assert.equal(out.contained, true);
    assert.match(out.body, /Mon–Fri/);
  });
});
