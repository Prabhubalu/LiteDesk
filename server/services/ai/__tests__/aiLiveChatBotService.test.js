'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldEscalateFromAnswer,
  formatBotReplyBody,
  answerLiveChatFaq,
} = require('../aiLiveChatBotService');
const { getPrompt } = require('../prompts/promptRegistry');
const { getBotDeflectionMetrics } = require('../../liveChatBotDeflectionService');

describe('aiLiveChatBotService', () => {
  it('escalates when not found or no citations', () => {
    assert.equal(shouldEscalateFromAnswer({ found: false, citations: [], answer: 'x' }), true);
    assert.equal(shouldEscalateFromAnswer({ found: true, citations: [], answer: 'x' }), true);
  });

  it('contains when found with citations and no escalate phrases', () => {
    assert.equal(
      shouldEscalateFromAnswer({
        found: true,
        citations: [{ index: 1 }],
        answer: 'Reset via Settings → Security.',
      }),
      false
    );
  });

  it('escalates when answer admits no match', () => {
    assert.equal(
      shouldEscalateFromAnswer({
        found: true,
        citations: [{ index: 1 }],
        answer: 'I could not find an answer in the knowledge base.',
      }),
      true
    );
  });

  it('formatBotReplyBody strips citation markers', () => {
    const body = formatBotReplyBody('Hello [1]\n\n[1]');
    assert.equal(body, 'Hello');
  });

  it('answerLiveChatFaq maps containment via injected askKnowledge', async () => {
    const result = await answerLiveChatFaq({
      organizationId: 'org1',
      question: 'How do I reset?',
      askKnowledgeFn: async () => ({
        answer: 'Use the reset link.',
        found: true,
        citations: [{ index: 1, sourceId: 'a1' }],
        provider: 'openai',
        model: 'gpt-test',
        keyMode: 'platform',
      }),
    });
    assert.equal(result.contained, true);
    assert.equal(result.escalateSuggested, false);
    assert.equal(result.answer, 'Use the reset link.');
  });

  it('registers live_chat_bot_faq_system prompt', () => {
    const prompt = getPrompt('live_chat_bot_faq_system');
    assert.equal(prompt.version, 'v1');
    assert.match(prompt.text, /knowledge excerpts/i);
    assert.match(prompt.text, /Never invent/);
  });
});

describe('liveChatBotDeflectionService', () => {
  it('computes deflection rate from counts', async () => {
    const calls = [];
    const Fake = {
      async countDocuments(q) {
        calls.push(q);
        if (q.botAiAnswered) return 2;
        if (q.botEscalated) return 3;
        return 10;
      },
    };
    const metrics = await getBotDeflectionMetrics({
      organizationId: 'org1',
      sinceDays: 7,
      ChatSessionModel: Fake,
    });
    assert.equal(metrics.botSessions, 10);
    assert.equal(metrics.escalated, 3);
    assert.equal(metrics.contained, 7);
    assert.equal(metrics.aiAnswered, 2);
    assert.equal(metrics.deflectionRate, 0.7);
    assert.equal(calls.length, 3);
  });
});
