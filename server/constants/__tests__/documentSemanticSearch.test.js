'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  tokenize,
  buildEmbedding,
  cosineSimilarity,
  buildDocumentSemanticSource,
  EMBEDDING_DIMENSIONS
} = require('../documentSemanticSearch');

describe('documentSemanticSearch', () => {
  it('tokenize removes stop words and punctuation', () => {
    const tokens = tokenize('The quick brown fox, and the lazy dog!');
    assert.ok(tokens.includes('quick'));
    assert.ok(tokens.includes('brown'));
    assert.ok(!tokens.includes('the'));
    assert.ok(!tokens.includes('and'));
  });

  it('buildEmbedding returns normalized vector of fixed dimensions', () => {
    const vector = buildEmbedding('sales contract renewal terms');
    assert.equal(vector.length, EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    assert.ok(Math.abs(norm - 1) < 0.0001);
  });

  it('cosineSimilarity ranks related text higher than unrelated text', () => {
    const source = buildEmbedding('customer onboarding checklist for new accounts');
    const related = buildEmbedding('onboarding checklist for new customer accounts');
    const unrelated = buildEmbedding('quarterly revenue forecast spreadsheet');
    assert.ok(cosineSimilarity(source, related) > cosineSimilarity(source, unrelated));
  });

  it('buildDocumentSemanticSource joins searchable fields', () => {
    const source = buildDocumentSemanticSource({
      title: 'Policy',
      description: 'HR policy',
      documentNumber: 'DOC-1',
      tags: ['hr', 'policy'],
      richContentText: 'Vacation days',
      ocrText: 'Scanned appendix'
    });
    assert.match(source, /Policy/);
    assert.match(source, /Vacation days/);
    assert.match(source, /Scanned appendix/);
  });
});
