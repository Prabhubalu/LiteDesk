'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBackfillQuery,
  buildAiEmbedBackfillQuery,
  parseArgs,
} = require('../backfillDocumentsSemanticIndex');

describe('backfillDocumentsSemanticIndex query', () => {
  it('targets documents missing semantic embeddings', () => {
    const query = buildBackfillQuery('org-1');
    assert.equal(query.organizationId, 'org-1');
    assert.equal(query.deletedAt, null);
    assert.ok(Array.isArray(query.$or));
  });

  it('omits organization filter when not scoped', () => {
    const query = buildBackfillQuery(null);
    assert.equal(query.organizationId, undefined);
  });

  it('AI embed query includes all non-deleted docs for an org', () => {
    const query = buildAiEmbedBackfillQuery('org-2');
    assert.equal(query.organizationId, 'org-2');
    assert.equal(query.deletedAt, null);
    assert.equal(query.$or, undefined);
  });

  it('parseArgs recognizes --ai-embed-only', () => {
    const args = parseArgs(['node', 'script', '--ai-embed-only', '--limit=10', '--organizationId=abc']);
    assert.equal(args.aiEmbed, true);
    assert.equal(args.aiEmbedOnly, true);
    assert.equal(args.limit, 10);
    assert.equal(args.organizationId, 'abc');
  });
});
