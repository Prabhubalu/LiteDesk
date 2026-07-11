'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { mergePortalKnowledgeRows } = require('../../portalKnowledgeMerge');

describe('portalKnowledgeService', () => {
  it('merges legacy and content studio rows by updatedAt descending', () => {
    const merged = mergePortalKnowledgeRows(
      [
        { _id: '1', title: 'Legacy', updatedAt: '2026-01-01T00:00:00.000Z' },
        { _id: '2', title: 'Legacy newer', updatedAt: '2026-03-01T00:00:00.000Z' },
      ],
      [
        { _id: '3', title: 'Studio newest', updatedAt: '2026-07-01T00:00:00.000Z', source: 'content_studio' },
      ],
    );

    assert.equal(merged.length, 3);
    assert.equal(merged[0]._id, '3');
    assert.equal(merged[1]._id, '2');
    assert.equal(merged[2]._id, '1');
  });

  it('returns empty array when both sources are empty', () => {
    assert.deepEqual(mergePortalKnowledgeRows([], []), []);
  });
});
