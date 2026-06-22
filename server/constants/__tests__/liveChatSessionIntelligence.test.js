'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveSentimentFromSession,
  deriveIntentFromText,
  deriveIntentFromMessages,
  deriveAiSummary,
  buildIntelligencePatchOnClose,
  normalizeSentiment,
  normalizeIntent,
} = require('../liveChatSessionIntelligence');

test('deriveSentimentFromSession maps CSAT scores', () => {
  assert.equal(deriveSentimentFromSession({ csatScore: 5 }), 'positive');
  assert.equal(deriveSentimentFromSession({ csatScore: 2 }), 'negative');
  assert.equal(deriveSentimentFromSession({ csatScore: 3 }), 'neutral');
});

test('deriveIntentFromText detects billing keywords', () => {
  assert.equal(deriveIntentFromText('I need a refund on my invoice'), 'billing');
});

test('deriveIntentFromMessages uses visitor messages only', () => {
  const intent = deriveIntentFromMessages([
    { authorType: 'agent', body: 'billing question' },
    { authorType: 'visitor', body: 'Can I get a demo of your product?' },
  ]);
  assert.equal(intent, 'sales');
});

test('deriveAiSummary prefers existing summary', () => {
  assert.equal(
    deriveAiSummary({ summary: 'Agent resolved login issue', messages: [] }),
    'Agent resolved login issue',
  );
});

test('buildIntelligencePatchOnClose skips when disabled', () => {
  const patch = buildIntelligencePatchOnClose({
    session: { csatScore: 5 },
    messages: [{ authorType: 'visitor', body: 'help me' }],
    enabled: false,
  });
  assert.deepEqual(patch, {});
});

test('buildIntelligencePatchOnClose fills empty fields when enabled', () => {
  const patch = buildIntelligencePatchOnClose({
    session: { csatScore: 5 },
    messages: [{ authorType: 'visitor', body: 'I need help with billing' }],
    enabled: true,
  });
  assert.equal(patch.sentiment, 'positive');
  assert.equal(patch.intent, 'billing');
  assert.equal(patch.aiIntent, 'billing');
  assert.equal(typeof patch.aiSentimentScore, 'number');
  assert.ok(String(patch.aiSummary || '').includes('billing'));
});

test('normalizeSentiment and normalizeIntent reject invalid values', () => {
  assert.equal(normalizeSentiment('positive'), 'positive');
  assert.equal(normalizeSentiment('angry'), null);
  assert.equal(normalizeIntent('support'), 'support');
  assert.equal(normalizeIntent('unknown'), null);
});
