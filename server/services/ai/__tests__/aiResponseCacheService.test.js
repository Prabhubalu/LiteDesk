'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCacheKey,
  buildScopeKey,
  isFresh,
  pickBestSemanticMatch,
  SEMANTIC_SIMILARITY_THRESHOLD,
} = require('../aiResponseCacheService');

function unit(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

describe('aiResponseCacheService semantic', () => {
  it('buildCacheKey is stable and question-normalized', () => {
    const a = buildCacheKey({ moduleKey: 'deals', recordId: 'r1', question: 'What next?', model: 'gpt-4o-mini', promptVersion: 'v1' });
    const b = buildCacheKey({ moduleKey: 'Deals', recordId: 'r1', question: '  what   NEXT? ', model: 'gpt-4o-mini', promptVersion: 'v1' });
    assert.equal(a, b);
  });

  it('buildCacheKey changes with model or record', () => {
    const base = buildCacheKey({ moduleKey: 'deals', recordId: 'r1', question: 'q', model: 'gpt-4o-mini', promptVersion: 'v1' });
    const diffModel = buildCacheKey({ moduleKey: 'deals', recordId: 'r1', question: 'q', model: 'gpt-4o', promptVersion: 'v1' });
    const diffRecord = buildCacheKey({ moduleKey: 'deals', recordId: 'r2', question: 'q', model: 'gpt-4o-mini', promptVersion: 'v1' });
    assert.notEqual(base, diffModel);
    assert.notEqual(base, diffRecord);
  });

  it('buildCacheKey includes agentId when provided', () => {
    const without = buildCacheKey({ moduleKey: 'deals', recordId: 'r1', question: 'q', model: 'm', promptVersion: 'v1' });
    const withAgent = buildCacheKey({ moduleKey: 'deals', recordId: 'r1', question: 'q', model: 'm', promptVersion: 'v1', agentId: 'a1' });
    assert.notEqual(without, withAgent);
  });

  it('buildScopeKey ignores question wording', () => {
    const a = buildScopeKey({ moduleKey: 'deals', recordId: 'r1', model: 'm', promptVersion: 'v1', agentId: 'a1' });
    const b = buildScopeKey({ moduleKey: 'deals', recordId: 'r1', model: 'm', promptVersion: 'v1', agentId: 'a1' });
    assert.equal(a, b);
    assert.notEqual(
      a,
      buildScopeKey({ moduleKey: 'deals', recordId: 'r1', model: 'm', promptVersion: 'v1', agentId: 'a2' }),
    );
  });

  it('isFresh invalidates on record change', () => {
    const now = new Date();
    const later = new Date(Date.now() + 60000);
    const cached = { recordUpdatedAt: now, expiresAt: later };
    assert.equal(isFresh(cached, now), true);
    assert.equal(isFresh(cached, new Date(Date.now() + 1000)), false);
  });

  it('isFresh invalidates on TTL expiry', () => {
    const past = new Date(Date.now() - 1000);
    const cached = { recordUpdatedAt: null, expiresAt: past };
    assert.equal(isFresh(cached, null), false);
  });

  it('pickBestSemanticMatch hits paraphrases above threshold', () => {
    const dealAnalyze = unit([0.9, 0.1, 0.05]);
    const analyzeDeal = unit([0.88, 0.12, 0.06]); // high similarity paraphrase
    const competitiveRisk = unit([0.1, 0.9, 0.2]); // different meaning
    const expiresAt = new Date(Date.now() + 60000);
    const candidates = [
      { questionEmbedding: dealAnalyze, payload: { answer: 'deal analysis' }, expiresAt },
      { questionEmbedding: competitiveRisk, payload: { answer: 'risk brief' }, expiresAt },
    ];

    const paraphrase = pickBestSemanticMatch(candidates, analyzeDeal, null);
    assert.ok(paraphrase.payload);
    assert.equal(paraphrase.payload.answer, 'deal analysis');
    assert.ok(paraphrase.score >= SEMANTIC_SIMILARITY_THRESHOLD);

    const different = pickBestSemanticMatch(candidates, competitiveRisk, null);
    // exact vector match to second candidate
    assert.ok(different.payload);
    assert.equal(different.payload.answer, 'risk brief');
  });

  it('pickBestSemanticMatch misses when meaning differs enough', () => {
    const dealAnalyze = unit([1, 0, 0]);
    const unrelated = unit([0, 1, 0]); // cosine ~ 0
    const expiresAt = new Date(Date.now() + 60000);
    const candidates = [
      { questionEmbedding: dealAnalyze, payload: { answer: 'deal analysis' }, expiresAt },
    ];
    const miss = pickBestSemanticMatch(candidates, unrelated, null);
    assert.equal(miss.payload, null);
    assert.ok(miss.score < SEMANTIC_SIMILARITY_THRESHOLD);
  });
});
