const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterHitsByScore,
  formatCitations,
  buildRagUserPrompt,
  normalizeQuestion,
} = require('../aiKnowledgeService');

describe('aiKnowledgeService RAG helpers', () => {
  it('normalizes and redacts question PII', () => {
    const q = normalizeQuestion('  Reset password for alice@example.com  ');
    assert.match(q, /Reset password/);
    assert.match(q, /\[EMAIL\]/);
    assert.doesNotMatch(q, /alice@example\.com/);
  });

  it('filters weak hits and formats citations', () => {
    const hits = filterHitsByScore([
      { chunkId: 'a', sourceType: 'document', sourceId: '1', chunkIndex: 0, text: 'Refund policy is 30 days', score: 0.55 },
      { chunkId: 'b', sourceType: 'document', sourceId: '2', chunkIndex: 0, text: 'noise', score: 0.05 },
    ], { topK: 3 });
    assert.equal(hits.length, 1);
    const citations = formatCitations(hits);
    assert.equal(citations[0].index, 1);
    assert.equal(citations[0].sourceId, '1');
    assert.match(citations[0].excerpt, /Refund policy/);
  });

  it('builds no-knowledge prompt when citations empty', () => {
    const prompt = buildRagUserPrompt('What is the refund policy?', []);
    assert.match(prompt, /No knowledge excerpts/);
    assert.match(prompt, /Do not invent facts/);
  });

  it('builds cited excerpt prompt', () => {
    const prompt = buildRagUserPrompt('What is the refund policy?', [{
      index: 1,
      sourceType: 'document',
      sourceId: 'doc1',
      score: 0.61,
      excerpt: 'Refunds within 30 days',
    }]);
    assert.match(prompt, /\[1\]/);
    assert.match(prompt, /Refunds within 30 days/);
    assert.match(prompt, /Cite sources as \[n\]/);
  });
});
