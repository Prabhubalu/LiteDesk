'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildBackfillQuery } = require('../backfillDocumentsSemanticIndex');

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
});
