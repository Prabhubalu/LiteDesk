const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createInMemoryVectorStore } = require('../vector/inMemoryVectorStore');

describe('inMemoryVectorStore', () => {
  it('filters by organizationId and ranks by cosine similarity', async () => {
    const store = createInMemoryVectorStore();
    await store.upsert([
      {
        organizationId: 'org-a',
        sourceType: 'document',
        sourceId: 'd1',
        chunkId: 'org-a:d1:0',
        chunkIndex: 0,
        text: 'alpha',
        embedding: [1, 0, 0],
      },
      {
        organizationId: 'org-b',
        sourceType: 'document',
        sourceId: 'd2',
        chunkId: 'org-b:d2:0',
        chunkIndex: 0,
        text: 'leak',
        embedding: [1, 0, 0],
      },
      {
        organizationId: 'org-a',
        sourceType: 'document',
        sourceId: 'd3',
        chunkId: 'org-a:d3:0',
        chunkIndex: 0,
        text: 'beta',
        embedding: [0, 1, 0],
      },
    ]);

    const hits = await store.search({
      organizationId: 'org-a',
      vector: [1, 0, 0],
      topK: 5,
    });

    assert.equal(hits.length, 2);
    assert.equal(hits[0].chunkId, 'org-a:d1:0');
    assert.ok(hits.every((h) => h.sourceId !== 'd2'));
  });

  it('Phase 0 exit: cross-tenant search returns nothing for foreign org', async () => {
    const store = createInMemoryVectorStore();
    await store.upsert([
      {
        organizationId: 'org-tenant-a',
        sourceType: 'document',
        sourceId: 'doc-a',
        chunkId: 'org-tenant-a:doc-a:0',
        chunkIndex: 0,
        text: 'secret-a',
        embedding: [1, 0, 0],
      },
    ]);

    const hits = await store.search({
      organizationId: 'org-tenant-b',
      vector: [1, 0, 0],
      topK: 5,
    });
    assert.equal(hits.length, 0);
  });

  it('deleteBySource removes only matching org+source rows', async () => {
    const store = createInMemoryVectorStore();
    await store.upsert([
      {
        organizationId: 'org-a',
        sourceType: 'document',
        sourceId: 'd1',
        chunkId: 'org-a:d1:0',
        text: 'keep-me-elsewhere',
        embedding: [1, 0],
      },
      {
        organizationId: 'org-a',
        sourceType: 'document',
        sourceId: 'd1',
        chunkId: 'org-a:d1:1',
        text: 'remove',
        embedding: [0, 1],
      },
    ]);

    await store.deleteBySource('org-a', 'document', 'd1');
    const hits = await store.search({
      organizationId: 'org-a',
      vector: [1, 0],
      topK: 5,
    });
    assert.equal(hits.length, 0);
  });
});
